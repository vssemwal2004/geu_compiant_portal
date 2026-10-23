// Ticket lifecycle rules (PDF §11). Pure functions — the same table drives the API and the portal
// (frontend/src/domain/lifecycle.ts), so the UI only ever offers actions the server will accept.

import { Role, TicketStatus } from '../common/enums';

export interface Actor {
  id: string;
  role: Role;
}

export interface LifecycleTicket {
  status: TicketStatus;
  creatorId: string;
  assignedTo: string | null;
  resolvedAt?: Date | null;
}

export interface TransitionOption {
  to: TicketStatus;
  label: string;
  /** The action must carry a note (resolution note, dispute reason, cancel reason). */
  noteRequired: boolean;
}

const ACTIVE = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.REOPENED];
const PENDING_WORK = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.REOPENED];

export const ACTIVE_STATUSES = ACTIVE;
export const PENDING_WORK_STATUSES = PENDING_WORK;
export const isActive = (s: TicketStatus) => ACTIVE.includes(s);

export function availableTransitions(
  t: LifecycleTicket,
  actor: Actor,
  disputeWindowHours: number,
  now = Date.now(),
): TransitionOption[] {
  const options: TransitionOption[] = [];
  const isAdmin = actor.role === Role.MAIN_ADMIN;
  const isAssignee = t.assignedTo !== null && t.assignedTo === actor.id;
  // Main Admin may override the assigned Sub-Admin, but someone must own the ticket.
  const mayWork = (actor.role === Role.SUB_ADMIN && isAssignee) || (isAdmin && t.assignedTo !== null);

  if (mayWork) {
    if (t.status === TicketStatus.OPEN) options.push({ to: TicketStatus.IN_PROGRESS, label: 'Accept & start work', noteRequired: false });
    if (t.status === TicketStatus.REOPENED) options.push({ to: TicketStatus.IN_PROGRESS, label: 'Resume work', noteRequired: false });
    if (t.status === TicketStatus.IN_PROGRESS) options.push({ to: TicketStatus.RESOLVED, label: 'Mark as resolved', noteRequired: true });
  }

  if (actor.role === Role.LAB_ASSISTANT && t.creatorId === actor.id && t.status === TicketStatus.RESOLVED) {
    options.push({ to: TicketStatus.CLOSED, label: 'Confirm it is fixed', noteRequired: false });
    const resolved = t.resolvedAt ? new Date(t.resolvedAt).getTime() : now;
    if (now - resolved < disputeWindowHours * 3_600_000)
      options.push({ to: TicketStatus.REOPENED, label: 'Dispute resolution', noteRequired: true });
  }

  if (isAdmin) {
    if (t.status === TicketStatus.CLOSED) options.push({ to: TicketStatus.REOPENED, label: 'Reopen ticket', noteRequired: true });
    if (isActive(t.status)) options.push({ to: TicketStatus.CANCELLED, label: 'Cancel ticket', noteRequired: true });
  }

  return options;
}

/** Role scoping (PDF §3): admin sees all, sub-admin assigned only, lab assistant own only. */
export function canView(t: LifecycleTicket, actor: Actor) {
  if (actor.role === Role.MAIN_ADMIN) return true;
  if (actor.role === Role.SUB_ADMIN) return t.assignedTo === actor.id;
  return t.creatorId === actor.id;
}

export const canPostUpdate = (t: LifecycleTicket, actor: Actor) => canView(t, actor) && isActive(t.status);

export const canEscalate = (t: LifecycleTicket, actor: Actor) =>
  actor.role === Role.SUB_ADMIN && t.assignedTo === actor.id && isActive(t.status);

/** Staff who may change priority: the Main Admin or the assigned Sub-Admin. */
export const canChangePriority = (t: LifecycleTicket, actor: Actor) =>
  isActive(t.status) && (actor.role === Role.MAIN_ADMIN || (actor.role === Role.SUB_ADMIN && t.assignedTo === actor.id));

/** Internal notes are staff-only and never sent to the lab assistant or WhatsApp. */
export const canSeeInternal = (actor: Actor) => actor.role !== Role.LAB_ASSISTANT;

export function ticketCode(seq: number, year: number) {
  return `GEU-${year}-${String(seq).padStart(6, '0')}`;
}

export const TICKET_CODE_PATTERN = /^GEU-\d{4}-\d{6}$/;
