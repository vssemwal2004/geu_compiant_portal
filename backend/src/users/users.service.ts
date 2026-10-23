import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import type { AuthUser } from '../common/auth-user';
import { Role, UserStatus } from '../common/enums';
import { toE164 } from '../common/phone';
import { escapeRegex } from '../common/regex';
import { AccountLinkPurpose } from '../auth/account-link.schema';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { LocationsService } from '../locations/locations.service';
import { TicketsService } from '../tickets/tickets.service';
import { User } from './user.schema';

export interface CreateUserInput {
  name: string;
  email: string;
  employeeId: string;
  role: Role.SUB_ADMIN | Role.LAB_ASSISTANT;
  title?: string;
  phone?: string;
  allowedLocationIds?: Types.ObjectId[];
}

export interface UpdateUserInput {
  name?: string;
  title?: string;
  phone?: string | null;
  allowedLocationIds?: Types.ObjectId[];
  status?: UserStatus.ACTIVE | UserStatus.DISABLED;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly auth: AuthService,
    private readonly locations: LocationsService,
    private readonly tickets: TicketsService,
    private readonly audit: AuditService,
  ) {}

  /** Main Admin provisions a Sub-Admin or Lab Assistant. Returns a one-time invite link to share. */
  async create(admin: AuthUser, input: CreateUserInput) {
    const phoneE164 = input.phone ? this.phone(input.phone) : undefined;
    const allowed = input.role === Role.LAB_ASSISTANT ? input.allowedLocationIds ?? [] : [];
    if (input.role === Role.LAB_ASSISTANT && !allowed.length)
      throw new BadRequestException('Give the lab assistant at least one location they may report for.');
    if (allowed.length) await this.locations.assertExist(allowed);

    let user;
    try {
      [user] = await this.users.create([
        {
          name: input.name,
          email: input.email,
          employeeId: input.employeeId,
          role: input.role,
          title: input.title ?? (input.role === Role.SUB_ADMIN ? 'Sub-Admin' : 'Lab Assistant'),
          phoneE164,
          allowedLocationIds: allowed,
          status: UserStatus.INVITED,
        },
      ]);
    } catch (e) {
      throw this.duplicate(e);
    }
    await this.audit.record({ actorId: admin.id, action: 'user.create', entityType: 'user', entityId: user._id, metadata: { role: input.role } });
    const invite = await this.auth.issueAccountLink(user._id, AccountLinkPurpose.INVITE, admin.id);
    return { user: this.view(user.toObject()), invite };
  }

  async list(q: { role?: Role; status?: UserStatus; q?: string; page: number; limit: number }) {
    const filter: FilterQuery<User> = {};
    if (q.role) filter.role = q.role;
    if (q.status) filter.status = q.status;
    if (q.q?.trim()) {
      const rx = new RegExp(escapeRegex(q.q.trim()), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { employeeId: rx }];
    }
    const [items, total] = await Promise.all([
      this.users.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
      this.users.countDocuments(filter),
    ]);
    return { items: items.map((u) => this.view(u)), total, page: q.page, limit: q.limit };
  }

  async get(id: Types.ObjectId) {
    const user = await this.users.findById(id).lean();
    if (!user) throw new NotFoundException('User not found.');
    return this.view(user);
  }

  async update(admin: AuthUser, id: Types.ObjectId, input: UpdateUserInput) {
    const user = await this.users.findById(id).select('+passwordHash');
    if (!user) throw new NotFoundException('User not found.');
    if (String(user._id) === String(admin.id) && input.status === UserStatus.DISABLED)
      throw new BadRequestException('You cannot deactivate your own account.');

    if (input.name !== undefined) user.name = input.name;
    if (input.title !== undefined) user.title = input.title;
    if (input.phone !== undefined) {
      const next = input.phone ? this.phone(input.phone) : undefined;
      if (next !== user.phoneE164) {
        user.phoneE164 = next;
        user.phoneVerifiedAt = undefined; // a new number must be verified again
      }
    }
    if (input.allowedLocationIds !== undefined) {
      if (user.role !== Role.LAB_ASSISTANT) throw new BadRequestException('Only lab assistants have location access.');
      await this.locations.assertExist(input.allowedLocationIds);
      user.allowedLocationIds = input.allowedLocationIds;
    }

    const wasDisabled = user.status === UserStatus.DISABLED;
    if (input.status === UserStatus.DISABLED) user.status = UserStatus.DISABLED;
    // Re-enabling: only accounts that have set a password become ACTIVE.
    if (input.status === UserStatus.ACTIVE) user.status = user.passwordHash ? UserStatus.ACTIVE : UserStatus.INVITED;

    try {
      await user.save();
    } catch (e) {
      throw this.duplicate(e);
    }

    let releasedTickets = 0;
    if (!wasDisabled && user.status === UserStatus.DISABLED) {
      await this.auth.revokeAll(user._id);
      if (user.role === Role.SUB_ADMIN) releasedTickets = await this.tickets.releaseTicketsOf(user._id, admin.id);
    }
    await this.audit.record({
      actorId: admin.id,
      action: 'user.update',
      entityType: 'user',
      entityId: user._id,
      metadata: { changed: Object.keys(input), status: user.status, releasedTickets },
    });
    return { user: this.view(user.toObject()), releasedTickets };
  }

  /** New one-time link: INVITE while the user has not set a password yet, RESET afterwards. */
  async accountLink(admin: AuthUser, id: Types.ObjectId) {
    const user = await this.users.findById(id).lean();
    if (!user) throw new NotFoundException('User not found.');
    if (user.status === UserStatus.DISABLED) throw new BadRequestException('Re-activate the account first.');
    const purpose = user.status === UserStatus.INVITED ? AccountLinkPurpose.INVITE : AccountLinkPurpose.RESET;
    const link = await this.auth.issueAccountLink(user._id, purpose, admin.id);
    await this.audit.record({ actorId: admin.id, action: `user.${purpose.toLowerCase()}_link`, entityType: 'user', entityId: user._id });
    return { purpose, ...link };
  }

  /**
   * Mark the WhatsApp number as verified after the admin has confirmed ownership in person.
   * (Automated OTP over WhatsApp arrives with the bot in Phase 3.)
   */
  async markPhoneVerified(admin: AuthUser, id: Types.ObjectId) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found.');
    if (!user.phoneE164) throw new BadRequestException('This user has no phone number.');
    user.phoneVerifiedAt = new Date();
    await user.save();
    await this.audit.record({ actorId: admin.id, action: 'user.phone_verified', entityType: 'user', entityId: user._id });
    return this.view(user.toObject());
  }

  private phone(raw: string) {
    const e164 = toE164(raw);
    if (!e164) throw new BadRequestException('Enter a valid mobile number, e.g. +91 98765 43210.');
    return e164;
  }

  private duplicate(e: unknown) {
    const err = e as { code?: number; keyPattern?: Record<string, unknown> };
    if (err.code !== 11000) return e;
    const field = Object.keys(err.keyPattern ?? {})[0];
    const label = field === 'email' ? 'email' : field === 'employeeId' ? 'employee ID' : field === 'phoneE164' ? 'phone number' : 'value';
    return new ConflictException(`Another account already uses this ${label}.`);
  }

  private view(u: User & { _id: Types.ObjectId; createdAt?: Date }) {
    return {
      id: u._id,
      name: u.name,
      email: u.email,
      employeeId: u.employeeId,
      role: u.role,
      title: u.title,
      phoneE164: u.phoneE164 ?? null,
      phoneVerified: !!u.phoneVerifiedAt,
      allowedLocationIds: u.allowedLocationIds ?? [],
      status: u.status,
      lastLoginAt: u.lastLoginAt ?? null,
      createdAt: u.createdAt,
    };
  }
}
