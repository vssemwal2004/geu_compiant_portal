// Pure ticket operations. Each returns a new ticket and appends a history event,
// matching the backend rule that every change is recorded (PDF §11, §14).

import { assetTypes } from '../data/mockData';
import { dueFrom } from './lifecycle';
import { resolveRoute } from './routing';
import type {
  Ticket,
  TicketEvent,
  TicketPriority,
  TicketSource,
  TicketStatus,
  Visibility,
} from './types';

let eventSeq = 0;
const eventId = () => `ev-${++eventSeq}`;

export function ticketCode(seq: number, year = new Date().getFullYear()) {
  return `GEU-${year}-${String(seq).padStart(6, '0')}`;
}

export interface NewTicketInput {
  creatorId: string;
  locationId: string;
  assetTypeId: string;
  description: string;
  source: TicketSource;
  imageUrl?: string;
  priority?: TicketPriority;
}

export function buildTicket(input: NewTicketInput, code: string, at: string): Ticket {
  const priority =
    input.priority ?? assetTypes.find((a) => a.id === input.assetTypeId)?.defaultPriority ?? 'MEDIUM';
  const route = resolveRoute(input.locationId, input.assetTypeId);

  const events: TicketEvent[] = [
    { id: eventId(), at, actorId: input.creatorId, kind: 'CREATED', to: 'OPEN', visibility: 'PUBLIC' },
    route
      ? { id: eventId(), at, actorId: null, kind: 'ASSIGNED', to: route.assigneeId, text: `Auto-routed by rule ${route.rule.id}`, visibility: 'PUBLIC' }
      : { id: eventId(), at, actorId: null, kind: 'ASSIGNED', to: null, text: 'No routing rule matched — sent to the unassigned queue', visibility: 'INTERNAL' },
  ];

  return {
    id: code,
    creatorId: input.creatorId,
    locationId: input.locationId,
    assetTypeId: input.assetTypeId,
    assignedTo: route?.assigneeId ?? null,
    routingRuleId: route?.rule.id ?? null,
    status: 'OPEN',
    priority,
    source: input.source,
    description: input.description,
    createdAt: at,
    dueAt: dueFrom(at, priority),
    imageUrl: input.imageUrl,
    events,
  };
}

export function transition(t: Ticket, to: TicketStatus, actorId: string, at: string, note?: string): Ticket {
  return {
    ...t,
    status: to,
    events: [
      ...t.events,
      { id: eventId(), at, actorId, kind: 'STATUS', from: t.status, to, text: note?.trim() || undefined, visibility: 'PUBLIC' },
    ],
  };
}

export function postMessage(t: Ticket, actorId: string, at: string, body: string, visibility: Visibility): Ticket {
  return {
    ...t,
    events: [...t.events, { id: eventId(), at, actorId, kind: 'MESSAGE', text: body.trim(), visibility }],
  };
}

export function assign(t: Ticket, assigneeId: string, actorId: string, at: string, reason?: string): Ticket {
  return {
    ...t,
    assignedTo: assigneeId,
    routingRuleId: null,
    events: [
      ...t.events,
      { id: eventId(), at, actorId, kind: 'ASSIGNED', from: t.assignedTo, to: assigneeId, text: reason?.trim() || 'Manually assigned', visibility: 'PUBLIC' },
    ],
  };
}

export function escalate(t: Ticket, actorId: string, at: string, reason: string): Ticket {
  return {
    ...t,
    events: [...t.events, { id: eventId(), at, actorId, kind: 'ESCALATION', text: reason.trim(), visibility: 'INTERNAL' }],
  };
}
