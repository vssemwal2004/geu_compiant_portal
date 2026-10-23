import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { seedTickets } from '../data/seedTickets';
import { availableTransitions, canAssign, canEscalate, canPostUpdate, canSeeInternal, canView } from '../domain/lifecycle';
import { assign, buildTicket, escalate, postMessage, ticketCode, transition, type NewTicketInput } from '../domain/ticketOps';
import { canRaiseAt } from '../domain/locations';
import type { Ticket, TicketStatus, User, Visibility } from '../domain/types';

// In-browser stand-in for the tickets API. Every action re-checks permissions the same way
// the backend will, so the UI cannot drift from the rules. Swap these bodies for fetch calls.

interface TicketStore {
  tickets: Ticket[];
  createTicket: (user: User, input: Omit<NewTicketInput, 'creatorId'>) => Ticket;
  changeStatus: (user: User, ticketId: string, to: TicketStatus, note?: string) => void;
  addUpdate: (user: User, ticketId: string, body: string, visibility: Visibility) => void;
  reassign: (user: User, ticketId: string, assigneeId: string, reason?: string) => void;
  requestEscalation: (user: User, ticketId: string, reason: string) => void;
}

const Ctx = createContext<TicketStore | null>(null);

const byNewest = (a: Ticket, b: Ticket) => b.createdAt.localeCompare(a.createdAt);
const nowIso = () => new Date().toISOString();

export function TicketStoreProvider({ children }: { children: ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>(() => [...seedTickets].sort(byNewest));
  const seq = useRef(Math.max(...seedTickets.map((t) => Number(t.id.slice(-6)))));

  const update = useCallback((id: string, fn: (t: Ticket) => Ticket | null) => {
    setTickets((all) => all.map((t) => (t.id === id ? fn(t) ?? t : t)));
  }, []);

  const createTicket = useCallback<TicketStore['createTicket']>((user, input) => {
    if (!canRaiseAt(user, input.locationId)) throw new Error('You cannot raise tickets for this location.');
    seq.current += 1;
    const ticket = buildTicket({ ...input, creatorId: user.id }, ticketCode(seq.current), nowIso());
    setTickets((all) => [ticket, ...all]);
    return ticket;
  }, []);

  const changeStatus = useCallback<TicketStore['changeStatus']>(
    (user, id, to, note) =>
      update(id, (t) => {
        const option = availableTransitions(t, user).find((o) => o.to === to);
        if (!option || (option.noteLabel && !note?.trim())) return null;
        return transition(t, to, user.id, nowIso(), note);
      }),
    [update],
  );

  const addUpdate = useCallback<TicketStore['addUpdate']>(
    (user, id, body, visibility) =>
      update(id, (t) => {
        if (!body.trim() || !canPostUpdate(user, t)) return null;
        const vis = visibility === 'INTERNAL' && canSeeInternal(user) ? 'INTERNAL' : 'PUBLIC';
        return postMessage(t, user.id, nowIso(), body, vis);
      }),
    [update],
  );

  const reassign = useCallback<TicketStore['reassign']>(
    (user, id, assigneeId, reason) =>
      update(id, (t) => (canAssign(user) && t.assignedTo !== assigneeId ? assign(t, assigneeId, user.id, nowIso(), reason) : null)),
    [update],
  );

  const requestEscalation = useCallback<TicketStore['requestEscalation']>(
    (user, id, reason) =>
      update(id, (t) => (canEscalate(user, t) && reason.trim() ? escalate(t, user.id, nowIso(), reason) : null)),
    [update],
  );

  const value = useMemo(
    () => ({ tickets, createTicket, changeStatus, addUpdate, reassign, requestEscalation }),
    [tickets, createTicket, changeStatus, addUpdate, reassign, requestEscalation],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTicketStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTicketStore must be used inside TicketStoreProvider');
  return ctx;
}

/** Tickets the given user is allowed to see (role-scoped, newest first). */
export function useVisibleTickets(user: User) {
  const { tickets } = useTicketStore();
  return useMemo(() => tickets.filter((t) => canView(user, t)), [tickets, user]);
}
