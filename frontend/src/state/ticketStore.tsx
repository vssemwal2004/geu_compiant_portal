import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';
import { canView } from '../domain/lifecycle';
import type { Ticket, TicketStatus, User, Visibility } from '../domain/types';
import { useSession } from './session';

interface NewTicketInput { locationId: string; assetTypeId: string; description: string; imageUrl?: string }
interface TicketStore {
  tickets: Ticket[];
  createTicket: (user: User, input: NewTicketInput) => Promise<Ticket>;
  changeStatus: (user: User, ticketId: string, to: TicketStatus, note?: string) => Promise<void>;
  addUpdate: (user: User, ticketId: string, body: string, visibility: Visibility) => Promise<void>;
  reassign: (user: User, ticketId: string, assigneeId: string, reason?: string) => Promise<void>;
  requestEscalation: (user: User, ticketId: string, reason: string) => Promise<void>;
}
const Ctx = createContext<TicketStore | null>(null);

export function TicketStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const refresh = useCallback(async () => {
    const all = await api<Ticket[]>('/tickets');
    setTickets(all);
  }, []);
  useEffect(() => {
    if (user) void refresh().catch(console.error);
    else setTickets([]);
  }, [user, refresh]);
  const update = useCallback((ticket: Ticket) => setTickets(all => [ticket, ...all.filter(t => t.id !== ticket.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))), []);
  const createTicket = useCallback<TicketStore['createTicket']>(async (_user, input) => {
    const ticket = await api<Ticket>('/tickets', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(input) });
    update(ticket);
    return ticket;
  }, [update]);
  const changeStatus = useCallback<TicketStore['changeStatus']>(async (_user, id, to, note) => {
    update(await api<Ticket>(`/tickets/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ to, note }) }));
  }, [update]);
  const addUpdate = useCallback<TicketStore['addUpdate']>(async (_user, id, body, visibility) => {
    update(await api<Ticket>(`/tickets/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ body, visibility }) }));
  }, [update]);
  const reassign = useCallback<TicketStore['reassign']>(async (_user, id, assigneeId, reason) => {
    update(await api<Ticket>(`/tickets/${encodeURIComponent(id)}/assignee`, { method: 'PATCH', body: JSON.stringify({ assigneeId, reason }) }));
  }, [update]);
  const requestEscalation = useCallback<TicketStore['requestEscalation']>(async (_user, id, reason) => {
    update(await api<Ticket>(`/tickets/${encodeURIComponent(id)}/escalations`, { method: 'POST', body: JSON.stringify({ reason }) }));
  }, [update]);
  const value = useMemo(() => ({ tickets, createTicket, changeStatus, addUpdate, reassign, requestEscalation }), [tickets, createTicket, changeStatus, addUpdate, reassign, requestEscalation]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useTicketStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTicketStore must be used inside TicketStoreProvider');
  return ctx;
}
export function useVisibleTickets(user: User) {
  const { tickets } = useTicketStore();
  return useMemo(() => tickets.filter(t => canView(user, t)), [tickets, user]);
}
