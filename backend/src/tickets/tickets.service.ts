import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, FilterQuery, Model, Types } from 'mongoose';
import { AppConfig } from '../config/app-config.service';
import type { AuthUser } from '../common/auth-user';
import {
  LocationType,
  Role,
  TicketEventKind,
  TicketPriority,
  TicketSource,
  TicketStatus,
  UserStatus,
  Visibility,
} from '../common/enums';
import { escapeRegex } from '../common/regex';
import { AssetTypesService } from '../asset-types/asset-types.service';
import { AuditService } from '../audit/audit.service';
import { LocationsService } from '../locations/locations.service';
import { OutboxChannel } from '../notifications/outbox.schema';
import { OutboxItem, OutboxService } from '../notifications/outbox.service';
import { RoutingService } from '../routing/routing.service';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/user.schema';
import { AttachmentInput, CreateTicketDto, ListTicketsQuery } from './dto';
import {
  Actor,
  ACTIVE_STATUSES,
  availableTransitions,
  canChangePriority,
  canEscalate,
  canPostUpdate,
  canSeeInternal,
  canView,
  isActive,
  LifecycleTicket,
  PENDING_WORK_STATUSES,
  ticketCode,
} from './lifecycle';
import { Counter } from './schemas/counter.schema';
import { Escalation, EscalationStatus } from './schemas/escalation.schema';
import { AttachmentKind, Ticket } from './schemas/ticket.schema';
import { TicketEvent } from './schemas/ticket-event.schema';

type LeanTicket = Ticket & { _id: Types.ObjectId };
type Channel = 'PORTAL' | 'WHATSAPP';

export interface ActionContext {
  ip?: string;
  channel?: Channel;
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(Ticket.name) private readonly tickets: Model<Ticket>,
    @InjectModel(TicketEvent.name) private readonly events: Model<TicketEvent>,
    @InjectModel(Escalation.name) private readonly escalations: Model<Escalation>,
    @InjectModel(Counter.name) private readonly counters: Model<Counter>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly locations: LocationsService,
    private readonly assetTypes: AssetTypesService,
    private readonly routing: RoutingService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
    private readonly config: AppConfig,
  ) {}

  // ───────────────────────────── create ─────────────────────────────

  /**
   * Create a ticket in one transaction: number + routing + ticket + history + audit + notifications.
   * With an idempotency key, retries (double tap, network retry, repeated WhatsApp "Confirm")
   * return the ticket created the first time instead of a duplicate.
   */
  async create(actor: AuthUser, dto: CreateTicketDto, opts: ActionContext & { source: TicketSource; idempotencyKey?: string }) {
    if (actor.role === Role.SUB_ADMIN) throw new ForbiddenException('Sub-Admins work on tickets but cannot raise them.');
    const key = opts.idempotencyKey?.trim().slice(0, 100) || undefined;
    if (key) {
      const existing = await this.tickets.findOne({ creatorId: actor.id, idempotencyKey: key }).lean();
      if (existing) return this.detail(existing, actor);
    }

    const asset = await this.assetTypes.get(new Types.ObjectId(dto.assetTypeId));
    if (!asset.active) throw new BadRequestException('This asset type is no longer in use.');
    const loc = await this.locations.get(new Types.ObjectId(dto.locationId));
    if (loc.type !== LocationType.LAB) throw new BadRequestException('Choose a specific lab or room.');
    if (!(await this.locations.isFullyActive(loc))) throw new BadRequestException('This location is not active.');
    if (!this.locations.canRaiseAt(actor, loc)) throw new ForbiddenException('You are not permitted to raise tickets for this location.');

    const attachments = await this.verifyAttachments(dto.attachments ?? [], actor.id, AttachmentKind.ISSUE);
    if (this.storage.configured && attachments.length === 0) throw new BadRequestException('Add a photo of the problem.');

    const path = this.locations.pathIds(loc);
    const now = new Date();
    const year = now.getFullYear();

    try {
      const created = await this.inTransaction(async (session) => {
        const counter = await this.counters
          .findOneAndUpdate({ _id: `ticket-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true, session })
          .lean();
        const rule = await this.routing.resolve(path, asset._id, session);

        const [t] = await this.tickets.create(
          [
            {
              code: ticketCode(counter!.seq, year),
              creatorId: actor.id,
              locationId: loc._id,
              locationPath: path,
              assetTypeId: asset._id,
              assignedTo: rule?.subAdminId ?? null,
              routingRuleId: rule?._id ?? null,
              status: TicketStatus.OPEN,
              priority: asset.defaultPriority,
              source: opts.source,
              description: dto.description.trim(),
              attachments,
              dueAt: this.dueAt(now, asset.defaultPriority),
              idempotencyKey: key,
            },
          ],
          { session },
        );

        await this.events.create(
          [
            { ticketId: t._id, kind: TicketEventKind.CREATED, actorId: actor.id, to: TicketStatus.OPEN, visibility: Visibility.PUBLIC, channel: opts.source },
            rule
              ? { ticketId: t._id, kind: TicketEventKind.ASSIGNED, actorId: null, to: String(rule.subAdminId), ruleId: rule._id, text: 'Auto-routed', visibility: Visibility.PUBLIC, channel: 'SYSTEM' }
              : { ticketId: t._id, kind: TicketEventKind.ASSIGNED, actorId: null, to: null, text: 'No routing rule matched — sent to the unassigned queue', visibility: Visibility.INTERNAL, channel: 'SYSTEM' },
          ],
          { session, ordered: true },
        );

        await this.audit.record(
          { actorId: actor.id, action: 'ticket.create', entityType: 'ticket', entityId: t._id, metadata: { code: t.code, source: opts.source, routedTo: rule?.subAdminId ?? null }, ip: opts.ip },
          session,
        );

        const notify: OutboxItem[] = [{ ticketId: t._id, recipientId: actor.id, channel: OutboxChannel.WHATSAPP, type: 'ticket.created', payload: { code: t.code } }];
        if (rule) notify.push({ ticketId: t._id, recipientId: rule.subAdminId, channel: OutboxChannel.PORTAL, type: 'ticket.assigned', payload: { code: t.code } });
        else
          for (const adminId of await this.mainAdminIds(session))
            notify.push({ ticketId: t._id, recipientId: adminId, channel: OutboxChannel.PORTAL, type: 'ticket.unassigned', payload: { code: t.code } });
        await this.outbox.enqueue(notify, session);

        return t.toObject() as LeanTicket;
      });
      return this.detail(created, actor);
    } catch (e) {
      // Two identical requests raced: the unique index let only one through — return it.
      if (key && (e as { code?: number }).code === 11000) {
        const existing = await this.tickets.findOne({ creatorId: actor.id, idempotencyKey: key }).lean();
        if (existing) return this.detail(existing, actor);
      }
      throw e;
    }
  }

  // ───────────────────────────── read ─────────────────────────────

  async list(actor: AuthUser, q: ListTicketsQuery) {
    const filter: FilterQuery<Ticket> = this.scope(actor);
    if (q.status) {
      const valid = Object.values(TicketStatus) as string[];
      const statuses = q.status.split(',').map((s) => s.trim().toUpperCase()).filter((s) => valid.includes(s));
      if (statuses.length) filter.status = { $in: statuses };
    }
    if (q.priority) filter.priority = q.priority;
    if (q.assetTypeId) filter.assetTypeId = new Types.ObjectId(q.assetTypeId);
    if (q.locationId) filter.locationPath = new Types.ObjectId(q.locationId);
    if (q.unassigned) filter.assignedTo = null;
    if (q.overdue) {
      filter.status = { $in: PENDING_WORK_STATUSES };
      filter.dueAt = { $lt: new Date() };
    }
    if (q.q?.trim()) {
      const rx = new RegExp(escapeRegex(q.q.trim()), 'i');
      filter.$or = [{ code: rx }, { description: rx }];
    }

    const [items, total] = await Promise.all([
      this.tickets.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      this.tickets.countDocuments(filter),
    ]);
    return { items: await this.present(items), total, page: q.page, limit: q.limit };
  }

  async get(actor: AuthUser, code: string) {
    return this.detail(await this.findVisible(code, actor), actor);
  }

  /** Counts for dashboards, scoped to what the user may see. */
  async summary(actor: AuthUser) {
    const match = this.scope(actor);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3_600_000);

    const [byStatus, overdue, unassigned, byPriority, byBuilding, resolvedLast7Days] = await Promise.all([
      this.tickets.aggregate<{ _id: TicketStatus; count: number }>([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.tickets.countDocuments({ ...match, status: { $in: PENDING_WORK_STATUSES }, dueAt: { $lt: now } }),
      actor.role === Role.MAIN_ADMIN ? this.tickets.countDocuments({ assignedTo: null, status: { $in: ACTIVE_STATUSES } }) : Promise.resolve(null),
      this.tickets.aggregate<{ _id: TicketPriority; count: number }>([
        { $match: { ...match, status: { $in: PENDING_WORK_STATUSES } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      // locationPath is [lab, floor, building, campus] — index 2 is the building.
      this.tickets.aggregate<{ _id: Types.ObjectId | null; count: number }>([
        { $match: match },
        { $group: { _id: { $arrayElemAt: ['$locationPath', 2] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),
      this.tickets.countDocuments({ ...match, resolvedAt: { $gte: weekAgo } }),
    ]);

    const buildingIds = byBuilding.map((b) => b._id).filter((id): id is Types.ObjectId => !!id);
    const names = await this.locations.describe(buildingIds);
    return {
      byStatus: Object.fromEntries(Object.values(TicketStatus).map((s) => [s, byStatus.find((b) => b._id === s)?.count ?? 0])),
      byPriority: Object.fromEntries(Object.values(TicketPriority).map((p) => [p, byPriority.find((b) => b._id === p)?.count ?? 0])),
      byBuilding: byBuilding
        .filter((b) => b._id)
        .map((b) => ({ locationId: b._id, name: names.get(String(b._id)) ?? 'Unknown', count: b.count })),
      overdue,
      unassigned,
      resolvedLast7Days,
    };
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  async changeStatus(actor: AuthUser, code: string, to: TicketStatus, note: string | undefined, ctx: ActionContext = {}) {
    const t = await this.findVisible(code, actor);
    const option = availableTransitions(this.life(t), this.actor(actor), this.config.disputeWindowHours).find((o) => o.to === to);
    if (!option) throw new ConflictException(`This ticket cannot move from ${t.status} to ${to} by you right now.`);
    const text = note?.trim() || undefined;
    if (option.noteRequired && !text) throw new BadRequestException('Please add a note for this action.');

    const now = new Date();
    const set: Record<string, unknown> = { status: to };
    if (to === TicketStatus.RESOLVED) set.resolvedAt = now;
    if (to === TicketStatus.CLOSED || to === TicketStatus.CANCELLED) set.closedAt = now;
    const update = to === TicketStatus.REOPENED ? { $set: set, $unset: { resolvedAt: 1, closedAt: 1 } } : { $set: set };

    await this.inTransaction(async (session) => {
      // Conditional on the old status: two people acting at once cannot both win.
      const res = await this.tickets.updateOne({ _id: t._id, status: t.status }, update, { session });
      if (res.modifiedCount !== 1) throw new ConflictException('This ticket was just changed by someone else. Refresh and try again.');
      await this.events.create(
        [{ ticketId: t._id, kind: TicketEventKind.STATUS, actorId: actor.id, from: t.status, to, text, visibility: Visibility.PUBLIC, channel: ctx.channel ?? 'PORTAL' }],
        { session },
      );
      await this.audit.record({ actorId: actor.id, action: 'ticket.status', entityType: 'ticket', entityId: t._id, metadata: { code, from: t.status, to }, ip: ctx.ip }, session);
      await this.outbox.enqueue(this.notifyParticipants(t, actor, `ticket.${to.toLowerCase()}`, { code, note: text }), session);
    });
    return this.get(actor, code);
  }

  /** Lab assistant confirms or disputes a resolution (POST /tickets/:code/feedback). */
  async feedback(actor: AuthUser, code: string, decision: 'CONFIRM' | 'DISPUTE', note: string | undefined, ctx: ActionContext = {}) {
    if (actor.role !== Role.LAB_ASSISTANT) throw new ForbiddenException('Only the person who raised the ticket can confirm or dispute it.');
    return this.changeStatus(actor, code, decision === 'CONFIRM' ? TicketStatus.CLOSED : TicketStatus.REOPENED, note, ctx);
  }

  async addMessage(actor: AuthUser, code: string, body: string, visibility: Visibility = Visibility.PUBLIC, ctx: ActionContext = {}) {
    const t = await this.findVisible(code, actor);
    if (!canPostUpdate(this.life(t), this.actor(actor))) throw new ConflictException('Updates are closed for this ticket.');
    // Lab assistants can only post public updates.
    const vis = canSeeInternal(this.actor(actor)) ? visibility : Visibility.PUBLIC;

    await this.inTransaction(async (session) => {
      await this.events.create(
        [{ ticketId: t._id, kind: TicketEventKind.MESSAGE, actorId: actor.id, text: body.trim(), visibility: vis, channel: ctx.channel ?? 'PORTAL' }],
        { session },
      );
      if (vis === Visibility.PUBLIC) await this.outbox.enqueue(this.notifyParticipants(t, actor, 'ticket.update', { code, text: body.trim() }), session);
    });
    return this.get(actor, code);
  }

  /** Main Admin assigns or reassigns (also resolves open escalations on the ticket). */
  async assign(actor: AuthUser, code: string, assigneeId: Types.ObjectId, reason: string | undefined, ctx: ActionContext = {}) {
    if (actor.role !== Role.MAIN_ADMIN) throw new ForbiddenException('Only the Main Admin can assign tickets.');
    const t = await this.findVisible(code, actor);
    if (!isActive(t.status)) throw new ConflictException('Closed or cancelled tickets cannot be reassigned.');
    if (t.assignedTo && String(t.assignedTo) === String(assigneeId)) throw new BadRequestException('The ticket is already assigned to this Sub-Admin.');
    const sa = await this.users.findById(assigneeId).lean();
    if (!sa || sa.role !== Role.SUB_ADMIN || sa.status !== UserStatus.ACTIVE) throw new BadRequestException('Choose an active Sub-Admin.');

    const now = new Date();
    await this.inTransaction(async (session) => {
      const res = await this.tickets.updateOne({ _id: t._id, assignedTo: t.assignedTo }, { $set: { assignedTo: sa._id, routingRuleId: null } }, { session });
      if (res.modifiedCount !== 1) throw new ConflictException('This ticket was just changed by someone else. Refresh and try again.');
      await this.events.create(
        [{ ticketId: t._id, kind: TicketEventKind.ASSIGNED, actorId: actor.id, from: t.assignedTo ? String(t.assignedTo) : null, to: String(sa._id), text: reason?.trim() || 'Assigned by the Main Admin', visibility: Visibility.PUBLIC, channel: 'PORTAL' }],
        { session },
      );
      await this.escalations.updateMany(
        { ticketId: t._id, status: EscalationStatus.OPEN },
        { $set: { status: EscalationStatus.RESOLVED, resolvedBy: actor.id, resolvedAt: now } },
        { session },
      );
      await this.audit.record({ actorId: actor.id, action: 'ticket.assign', entityType: 'ticket', entityId: t._id, metadata: { code, from: t.assignedTo, to: sa._id }, ip: ctx.ip }, session);

      const notify: OutboxItem[] = [
        { ticketId: t._id, recipientId: sa._id, channel: OutboxChannel.PORTAL, type: 'ticket.assigned', payload: { code } },
        { ticketId: t._id, recipientId: t.creatorId, channel: OutboxChannel.WHATSAPP, type: 'ticket.assigned', payload: { code, assignee: sa.name } },
      ];
      if (t.assignedTo) notify.push({ ticketId: t._id, recipientId: t.assignedTo, channel: OutboxChannel.PORTAL, type: 'ticket.reassigned_away', payload: { code } });
      await this.outbox.enqueue(notify, session);
    });
    return this.get(actor, code);
  }

  async changePriority(actor: AuthUser, code: string, priority: TicketPriority, reason: string | undefined, ctx: ActionContext = {}) {
    const t = await this.findVisible(code, actor);
    if (!canChangePriority(this.life(t), this.actor(actor))) throw new ForbiddenException('You cannot change the priority of this ticket.');
    if (t.priority === priority) return this.get(actor, code);

    await this.inTransaction(async (session) => {
      await this.tickets.updateOne({ _id: t._id }, { $set: { priority, dueAt: this.dueAt(t.createdAt, priority) } }, { session });
      await this.events.create(
        [{ ticketId: t._id, kind: TicketEventKind.PRIORITY, actorId: actor.id, from: t.priority, to: priority, text: reason?.trim(), visibility: Visibility.PUBLIC, channel: 'PORTAL' }],
        { session },
      );
      await this.audit.record({ actorId: actor.id, action: 'ticket.priority', entityType: 'ticket', entityId: t._id, metadata: { code, from: t.priority, to: priority }, ip: ctx.ip }, session);
    });
    return this.get(actor, code);
  }

  /** Assigned Sub-Admin asks the Main Admin to intervene (PDF §10.08). */
  async escalate(actor: AuthUser, code: string, reason: string, ctx: ActionContext = {}) {
    const t = await this.findVisible(code, actor);
    if (!canEscalate(this.life(t), this.actor(actor))) throw new ForbiddenException('Only the assigned Sub-Admin can request escalation.');
    if (await this.escalations.exists({ ticketId: t._id, status: EscalationStatus.OPEN }))
      throw new ConflictException('An escalation is already open for this ticket.');

    await this.inTransaction(async (session) => {
      const [esc] = await this.escalations.create([{ ticketId: t._id, requestedBy: actor.id, reason: reason.trim() }], { session });
      await this.events.create(
        [{ ticketId: t._id, kind: TicketEventKind.ESCALATION, actorId: actor.id, text: reason.trim(), visibility: Visibility.INTERNAL, channel: 'PORTAL' }],
        { session },
      );
      await this.audit.record({ actorId: actor.id, action: 'ticket.escalate', entityType: 'ticket', entityId: t._id, metadata: { code, escalationId: esc._id }, ip: ctx.ip }, session);
      await this.outbox.enqueue(
        (await this.mainAdminIds(session)).map((id) => ({ ticketId: t._id, recipientId: id, channel: OutboxChannel.PORTAL, type: 'ticket.escalated', payload: { code, reason: reason.trim() } })),
        session,
      );
    });
    return this.get(actor, code);
  }

  listEscalations(status?: EscalationStatus) {
    return this.escalations
      .find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('ticketId', 'code status priority')
      .populate('requestedBy', 'name email')
      .lean();
  }

  /** Creator adds an issue photo; assigned staff add completion evidence. */
  async addAttachment(actor: AuthUser, code: string, input: AttachmentInput, ctx: ActionContext = {}) {
    const t = await this.findVisible(code, actor);
    if (!isActive(t.status)) throw new ConflictException('Attachments are closed for this ticket.');
    const isCreator = String(t.creatorId) === String(actor.id);
    const isStaff = actor.role === Role.MAIN_ADMIN || (actor.role === Role.SUB_ADMIN && String(t.assignedTo) === String(actor.id));
    if (!isCreator && !isStaff) throw new ForbiddenException('You cannot add attachments to this ticket.');
    if (t.attachments.length >= 10) throw new BadRequestException('This ticket already has the maximum number of attachments.');

    const [att] = await this.verifyAttachments([input], actor.id, isCreator ? AttachmentKind.ISSUE : AttachmentKind.EVIDENCE);
    await this.inTransaction(async (session) => {
      await this.tickets.updateOne({ _id: t._id }, { $push: { attachments: att } }, { session });
      await this.events.create(
        [{ ticketId: t._id, kind: TicketEventKind.ATTACHMENT, actorId: actor.id, text: att.kind === AttachmentKind.EVIDENCE ? 'Added completion evidence' : 'Added a photo', visibility: Visibility.PUBLIC, channel: ctx.channel ?? 'PORTAL' }],
        { session },
      );
      await this.audit.record({ actorId: actor.id, action: 'ticket.attachment', entityType: 'ticket', entityId: t._id, metadata: { code, storageKey: att.storageKey }, ip: ctx.ip }, session);
    });
    return this.get(actor, code);
  }

  /** When a Sub-Admin is deactivated their open tickets go back to the unassigned queue. */
  async releaseTicketsOf(subAdminId: Types.ObjectId, actorId: Types.ObjectId) {
    const open = await this.tickets.find({ assignedTo: subAdminId, status: { $in: ACTIVE_STATUSES } }).select('_id code').lean();
    if (!open.length) return 0;
    await this.inTransaction(async (session) => {
      await this.tickets.updateMany({ _id: { $in: open.map((t) => t._id) }, assignedTo: subAdminId }, { $set: { assignedTo: null, routingRuleId: null } }, { session });
      await this.events.insertMany(
        open.map((t) => ({ ticketId: t._id, kind: TicketEventKind.ASSIGNED, actorId, from: String(subAdminId), to: null, text: 'Sub-Admin account deactivated — back in the unassigned queue', visibility: Visibility.INTERNAL, channel: 'SYSTEM' })),
        { session },
      );
      await this.audit.record({ actorId, action: 'user.release_tickets', entityType: 'user', entityId: subAdminId, metadata: { count: open.length, codes: open.map((t) => t.code) } }, session);
      await this.outbox.enqueue(
        (await this.mainAdminIds(session)).map((id) => ({ recipientId: id, channel: OutboxChannel.PORTAL, type: 'tickets.released', payload: { count: open.length, codes: open.map((t) => t.code) } })),
        session,
      );
    });
    return open.length;
  }

  // ───────────────────────────── helpers ─────────────────────────────

  private actor(u: AuthUser): Actor {
    return { id: String(u.id), role: u.role };
  }

  private life(t: LeanTicket): LifecycleTicket {
    return { status: t.status, creatorId: String(t.creatorId), assignedTo: t.assignedTo ? String(t.assignedTo) : null, resolvedAt: t.resolvedAt ?? null };
  }

  private scope(actor: AuthUser): FilterQuery<Ticket> {
    if (actor.role === Role.MAIN_ADMIN) return {};
    if (actor.role === Role.SUB_ADMIN) return { assignedTo: actor.id };
    return { creatorId: actor.id };
  }

  /** Same 404 for "does not exist" and "not yours", so ticket codes cannot be probed. */
  private async findVisible(code: string, actor: AuthUser): Promise<LeanTicket> {
    const t = await this.tickets.findOne({ code }).lean();
    if (!t || !canView(this.life(t), this.actor(actor))) throw new NotFoundException('Ticket not found.');
    return t;
  }

  private dueAt(from: Date, priority: TicketPriority) {
    return new Date(new Date(from).getTime() + this.config.slaHours[priority] * 3_600_000);
  }

  private async inTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.conn.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  private async mainAdminIds(session?: ClientSession) {
    const admins = await this.users.find({ role: Role.MAIN_ADMIN, status: UserStatus.ACTIVE }).select('_id').session(session ?? null).lean();
    return admins.map((a) => a._id);
  }

  /** Notify the creator (WhatsApp) and the assignee (portal) — never the person who acted. */
  private notifyParticipants(t: LeanTicket, actor: AuthUser, type: string, payload: Record<string, unknown>): OutboxItem[] {
    const items: OutboxItem[] = [];
    if (String(t.creatorId) !== String(actor.id))
      items.push({ ticketId: t._id, recipientId: t.creatorId, channel: OutboxChannel.WHATSAPP, type, payload });
    if (t.assignedTo && String(t.assignedTo) !== String(actor.id))
      items.push({ ticketId: t._id, recipientId: t.assignedTo, channel: OutboxChannel.PORTAL, type, payload });
    return items;
  }

  private async verifyAttachments(inputs: AttachmentInput[], uploaderId: Types.ObjectId, kind: AttachmentKind) {
    const out = [];
    for (const a of inputs) {
      const verified = await this.storage.verifyUpload(a.storageKey, uploaderId);
      out.push({ storageKey: a.storageKey, mimeType: verified.mimeType, sizeBytes: verified.sizeBytes, kind, uploaderId });
    }
    return out;
  }

  /** List rows with names resolved in batches (no N+1 queries). */
  private async present(items: LeanTicket[]) {
    const userIds = [...new Set(items.flatMap((t) => [t.creatorId, t.assignedTo]).filter(Boolean).map(String))];
    const [people, assets, labels] = await Promise.all([
      this.users.find({ _id: { $in: userIds } }).select('name role').lean(),
      this.assetTypes.list(true),
      this.locations.describe(items.map((t) => t.locationId)),
    ]);
    const person = new Map(people.map((p) => [String(p._id), { id: p._id, name: p.name }]));
    const asset = new Map(assets.map((a) => [String(a._id), { id: a._id, name: a.name, code: a.code }]));
    const now = Date.now();

    return items.map((t) => ({
      id: t._id,
      code: t.code,
      status: t.status,
      priority: t.priority,
      source: t.source,
      description: t.description,
      location: { id: t.locationId, label: labels.get(String(t.locationId)) ?? '' },
      assetType: asset.get(String(t.assetTypeId)) ?? null,
      creator: person.get(String(t.creatorId)) ?? null,
      assignee: t.assignedTo ? person.get(String(t.assignedTo)) ?? null : null,
      dueAt: t.dueAt,
      overdue: PENDING_WORK_STATUSES.includes(t.status) && new Date(t.dueAt).getTime() < now,
      resolvedAt: t.resolvedAt ?? null,
      closedAt: t.closedAt ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      attachmentCount: t.attachments?.length ?? 0,
    }));
  }

  /** Full ticket for the detail page: history (internal notes hidden from lab assistants), photos, and allowed actions. */
  private async detail(t: LeanTicket, actor: AuthUser) {
    const a = this.actor(actor);
    const [base] = await this.present([t]);
    const rawEvents = await this.events.find({ ticketId: t._id }).sort({ createdAt: 1 }).lean();
    const events = canSeeInternal(a) ? rawEvents : rawEvents.filter((e) => e.visibility === Visibility.PUBLIC);

    const ids = new Set<string>();
    for (const e of events) {
      if (e.actorId) ids.add(String(e.actorId));
      if (e.kind === TicketEventKind.ASSIGNED) [e.from, e.to].forEach((x) => x && ids.add(x));
    }
    const people = new Map(
      (await this.users.find({ _id: { $in: [...ids] } }).select('name').lean()).map((p) => [String(p._id), p.name]),
    );

    const attachments = await Promise.all(
      (t.attachments ?? []).map(async (att) => ({
        kind: att.kind,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        url: await this.storage.downloadUrl(att.storageKey),
      })),
    );

    const life = this.life(t);
    return {
      ...base,
      attachments,
      events: events.map((e) => ({
        id: e._id,
        kind: e.kind,
        actor: e.actorId ? { id: e.actorId, name: people.get(String(e.actorId)) ?? 'Unknown' } : null,
        from: e.from,
        to: e.to,
        ...(e.kind === TicketEventKind.ASSIGNED
          ? { fromName: e.from ? people.get(e.from) ?? null : null, toName: e.to ? people.get(e.to) ?? null : null }
          : {}),
        text: e.text,
        visibility: e.visibility,
        channel: e.channel,
        createdAt: e.createdAt,
      })),
      allowedTransitions: availableTransitions(life, a, this.config.disputeWindowHours),
      permissions: {
        canPostUpdate: canPostUpdate(life, a),
        canPostInternal: canSeeInternal(a) && canPostUpdate(life, a),
        canEscalate: canEscalate(life, a),
        canAssign: actor.role === Role.MAIN_ADMIN && isActive(t.status),
        canChangePriority: canChangePriority(life, a),
      },
    };
  }
}
