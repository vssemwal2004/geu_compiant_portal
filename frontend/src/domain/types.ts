// Domain types shared by every role. They mirror the backend collections in the plan
// (users, locations, assetTypes, routingRules, tickets + ticketEvents).

export type Role = 'MAIN_ADMIN' | 'SUB_ADMIN' | 'LAB_ASSISTANT';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REOPENED' | 'CLOSED' | 'CANCELLED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketSource = 'PORTAL' | 'WHATSAPP';
export type Visibility = 'PUBLIC' | 'INTERNAL';

export interface User {
  id: string;
  name: string;
  email?: string;
  employeeId: string;
  role: Role;
  title: string;
  phone?: string;
  /** Lab Assistants only: locations they may raise tickets for (descendants included). */
  allowedLocationIds?: string[];
  scopeLocationIds?: string[];
  defaultLocationId?: string;
  permissions?: string[];
  status?: 'ACTIVE' | 'INVITED' | 'DISABLED';
  passwordChangeRequired?: boolean;
}

export type LocationType = 'CAMPUS' | 'BUILDING' | 'FLOOR' | 'LAB';

export interface Location {
  id: string;
  parentId: string | null;
  type: LocationType;
  name: string;
}

export interface AssetType {
  id: string;
  name: string;
  code: string;
  defaultPriority: TicketPriority;
}

export interface RoutingRule {
  id: string;
  locationId: string;
  assetTypeId: string;
  subAdminId: string;
  active: boolean;
}

export type TicketEventKind = 'CREATED' | 'STATUS' | 'ASSIGNED' | 'MESSAGE' | 'ESCALATION' | 'EVIDENCE' | 'PRIORITY';

export interface TicketEvent {
  id: string;
  at: string;
  actorId: string | null;
  kind: TicketEventKind;
  from?: string | null;
  to?: string | null;
  text?: string;
  visibility: Visibility;
}

export interface Ticket {
  id: string; // equals the human ticket code, e.g. GEU-2026-000187
  creatorId: string;
  locationId: string;
  assetTypeId: string;
  assignedTo: string | null;
  routingRuleId: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  description: string;
  createdAt: string;
  dueAt: string;
  imageUrl?: string;
  evidenceUrls?: string[];
  events: TicketEvent[];
}
