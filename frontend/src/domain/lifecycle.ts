import type { Ticket, TicketPriority, TicketStatus, User } from './types';

// SLA target per priority, in hours (configurable on the backend later).
export const SLA_HOURS: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 96,
};

/** Creator may dispute a resolution within this window; after it the ticket auto-closes. */
export const DISPUTE_WINDOW_HOURS = 72;

const ACTIVE: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REOPENED'];

export const isActive = (t: Ticket) => ACTIVE.includes(t.status);

/** Work still pending on staff side (resolved tickets wait on the creator, not staff). */
export const isPendingWork = (t: Ticket) =>
  t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'REOPENED';

export const isOverdue = (t: Ticket, now = Date.now()) =>
  isPendingWork(t) && new Date(t.dueAt).getTime() < now;

export function dueFrom(createdAt: string, priority: TicketPriority) {
  return new Date(new Date(createdAt).getTime() + SLA_HOURS[priority] * 3_600_000).toISOString();
}

export function resolvedAt(t: Ticket): string | undefined {
  return [...t.events].reverse().find((e) => e.kind === 'STATUS' && e.to === 'RESOLVED')?.at;
}

export interface TransitionOption {
  to: TicketStatus;
  label: string;
  tone: 'primary' | 'accent' | 'ghost' | 'danger';
  /** When set, the action asks for a note with this label and refuses an empty one. */
  noteLabel?: string;
}

/**
 * Status changes the given user may make right now (architecture PDF §11).
 * The backend enforces the same table; the UI only uses it to decide which buttons to show.
 */
export function availableTransitions(t: Ticket, user: User, now = Date.now()): TransitionOption[] {
  const options: TransitionOption[] = [];
  const isAssignee = t.assignedTo === user.id;
  const isAdmin = user.role === 'MAIN_ADMIN';
  const staffMayWork = (user.role === 'SUB_ADMIN' && isAssignee) || (isAdmin && t.assignedTo !== null);

  if (staffMayWork) {
    if (t.status === 'OPEN') options.push({ to: 'IN_PROGRESS', label: 'Accept & start work', tone: 'primary' });
    if (t.status === 'REOPENED') options.push({ to: 'IN_PROGRESS', label: 'Resume work', tone: 'primary' });
    if (t.status === 'IN_PROGRESS')
      options.push({ to: 'RESOLVED', label: 'Mark as resolved', tone: 'accent', noteLabel: 'Resolution note' });
  }

  if (user.role === 'LAB_ASSISTANT' && t.creatorId === user.id && t.status === 'RESOLVED') {
    const at = resolvedAt(t);
    const withinWindow = !at || now - new Date(at).getTime() < DISPUTE_WINDOW_HOURS * 3_600_000;
    options.push({ to: 'CLOSED', label: 'Confirm it is fixed', tone: 'accent' });
    if (withinWindow)
      options.push({ to: 'REOPENED', label: 'Dispute resolution', tone: 'danger', noteLabel: 'What is still wrong?' });
  }

  if (isAdmin) {
    if (t.status === 'CLOSED') options.push({ to: 'REOPENED', label: 'Reopen ticket', tone: 'ghost', noteLabel: 'Reason for reopening' });
    if (isActive(t)) options.push({ to: 'CANCELLED', label: 'Cancel ticket', tone: 'danger', noteLabel: 'Reason for cancelling' });
  }

  return options;
}

/** Role scoping (PDF §3): admin sees all, sub-admin assigned only, lab assistant own only. */
export function canView(user: User, t: Ticket) {
  if (user.role === 'MAIN_ADMIN') return true;
  if (user.role === 'SUB_ADMIN') return t.assignedTo === user.id;
  return t.creatorId === user.id;
}

export const canAssign = (user: User) => user.role === 'MAIN_ADMIN';

export const canEscalate = (user: User, t: Ticket) =>
  user.role === 'SUB_ADMIN' && t.assignedTo === user.id && isActive(t);

export const canPostUpdate = (user: User, t: Ticket) => canView(user, t) && isActive(t);

/** Internal notes are staff-only and never shown to the Lab Assistant or sent on WhatsApp. */
export const canSeeInternal = (user: User) => user.role !== 'LAB_ASSISTANT';
