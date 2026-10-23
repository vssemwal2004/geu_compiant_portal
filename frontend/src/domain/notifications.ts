import { canSeeInternal, canView } from './lifecycle';
import { userName } from './format';
import type { Ticket, TicketEvent, User } from './types';

export interface Notification {
  id: string;
  ticketId: string;
  title: string;
  text: string;
  at: string;
  unread: boolean;
}

const UNREAD_WINDOW_MS = 6 * 3_600_000;

const statusWords: Record<string, string> = {
  IN_PROGRESS: 'is now in progress',
  RESOLVED: 'was marked resolved',
  REOPENED: 'was reopened',
  CLOSED: 'was closed',
  CANCELLED: 'was cancelled',
};

function describe(e: TicketEvent, t: Ticket, user: User): { title: string; text: string } | null {
  const own = e.actorId === user.id;
  if (own) return null;

  switch (e.kind) {
    case 'CREATED':
      if (user.role === 'LAB_ASSISTANT') return null;
      return { title: `New ticket ${t.id}`, text: `${userName(e.actorId)} · ${t.description}` };
    case 'ASSIGNED':
      if (user.role === 'MAIN_ADMIN' && e.to === null) return { title: 'Unassigned ticket', text: `${t.id} matched no routing rule` };
      if (user.role === 'SUB_ADMIN' && e.to === user.id) return { title: `Assigned to you: ${t.id}`, text: e.text ?? '' };
      if (user.role === 'LAB_ASSISTANT' && e.to) return { title: `${t.id} assigned`, text: `Routed to ${userName(e.to)}` };
      return null;
    case 'STATUS':
      if (!e.to || !statusWords[e.to]) return null;
      return { title: `${t.id} ${statusWords[e.to]}`, text: e.text ?? `by ${userName(e.actorId)}` };
    case 'MESSAGE':
      return { title: `Update on ${t.id}`, text: `${userName(e.actorId)}: ${e.text ?? ''}` };
    case 'ESCALATION':
      return user.role === 'MAIN_ADMIN' ? { title: `Escalation on ${t.id}`, text: e.text ?? '' } : null;
    case 'EVIDENCE':
      return { title: `Evidence added to ${t.id}`, text: `${userName(e.actorId)} uploaded a resolution photo` };
    case 'PRIORITY':
      return { title: `Priority changed on ${t.id}`, text: e.text ?? '' };
  }
}

/** Recent activity relevant to this user, derived from ticket history (newest first). */
export function notificationsFor(user: User, tickets: Ticket[], limit = 6, now = Date.now()): Notification[] {
  const items: Notification[] = [];
  for (const t of tickets) {
    if (!canView(user, t)) continue;
    for (const e of t.events) {
      if (e.visibility === 'INTERNAL' && !canSeeInternal(user)) continue;
      const d = describe(e, t, user);
      if (!d) continue;
      items.push({ id: e.id, ticketId: t.id, ...d, at: e.at, unread: now - new Date(e.at).getTime() < UNREAD_WINDOW_MS });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
