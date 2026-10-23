import { Role, TicketStatus } from '../common/enums';
import { availableTransitions, canEscalate, canView, LifecycleTicket, ticketCode } from './lifecycle';

const admin = { id: 'admin', role: Role.MAIN_ADMIN };
const sub = { id: 'sub', role: Role.SUB_ADMIN };
const otherSub = { id: 'sub2', role: Role.SUB_ADMIN };
const lab = { id: 'lab', role: Role.LAB_ASSISTANT };
const otherLab = { id: 'lab2', role: Role.LAB_ASSISTANT };

const ticket = (status: TicketStatus, extra: Partial<LifecycleTicket> = {}): LifecycleTicket => ({
  status,
  creatorId: 'lab',
  assignedTo: 'sub',
  ...extra,
});
const targets = (t: LifecycleTicket, actor: typeof admin, now = Date.now()) =>
  availableTransitions(t, actor, 72, now).map((o) => o.to);

describe('ticket lifecycle (PDF §11)', () => {
  it('assigned Sub-Admin accepts, resolves and resumes', () => {
    expect(targets(ticket(TicketStatus.OPEN), sub)).toEqual([TicketStatus.IN_PROGRESS]);
    expect(targets(ticket(TicketStatus.IN_PROGRESS), sub)).toEqual([TicketStatus.RESOLVED]);
    expect(targets(ticket(TicketStatus.REOPENED), sub)).toEqual([TicketStatus.IN_PROGRESS]);
  });

  it('resolving requires a note', () => {
    const [resolve] = availableTransitions(ticket(TicketStatus.IN_PROGRESS), sub, 72);
    expect(resolve.noteRequired).toBe(true);
  });

  it('another Sub-Admin can do nothing', () => {
    expect(targets(ticket(TicketStatus.OPEN), otherSub)).toEqual([]);
  });

  it('creator confirms or disputes a resolution within the window', () => {
    const resolvedAt = new Date(Date.now() - 2 * 3_600_000);
    expect(targets(ticket(TicketStatus.RESOLVED, { resolvedAt }), lab)).toEqual([TicketStatus.CLOSED, TicketStatus.REOPENED]);
  });

  it('dispute is no longer offered after the window', () => {
    const resolvedAt = new Date(Date.now() - 80 * 3_600_000);
    expect(targets(ticket(TicketStatus.RESOLVED, { resolvedAt }), lab)).toEqual([TicketStatus.CLOSED]);
  });

  it('another lab assistant cannot confirm', () => {
    expect(targets(ticket(TicketStatus.RESOLVED), otherLab)).toEqual([]);
  });

  it('Main Admin can override work, cancel active tickets and reopen closed ones', () => {
    expect(targets(ticket(TicketStatus.OPEN), admin)).toEqual([TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED]);
    expect(targets(ticket(TicketStatus.CLOSED), admin)).toEqual([TicketStatus.REOPENED]);
    expect(targets(ticket(TicketStatus.CANCELLED), admin)).toEqual([]);
  });

  it('nobody can start work on an unassigned ticket', () => {
    expect(targets(ticket(TicketStatus.OPEN, { assignedTo: null }), admin)).toEqual([TicketStatus.CANCELLED]);
  });
});

describe('visibility (PDF §3)', () => {
  const t = ticket(TicketStatus.OPEN);
  it('admin sees all, sub-admin only assigned, lab assistant only own', () => {
    expect(canView(t, admin)).toBe(true);
    expect(canView(t, sub)).toBe(true);
    expect(canView(t, otherSub)).toBe(false);
    expect(canView(t, lab)).toBe(true);
    expect(canView(t, otherLab)).toBe(false);
  });

  it('only the assigned Sub-Admin may escalate an active ticket', () => {
    expect(canEscalate(t, sub)).toBe(true);
    expect(canEscalate(t, admin)).toBe(false);
    expect(canEscalate(ticket(TicketStatus.CLOSED), sub)).toBe(false);
  });
});

describe('ticket code', () => {
  it('is zero-padded per year', () => {
    expect(ticketCode(187, 2026)).toBe('GEU-2026-000187');
  });
});
