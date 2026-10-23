// Shared vocabulary — mirrors frontend/src/domain/types.ts.

export enum Role {
  MAIN_ADMIN = 'MAIN_ADMIN',
  SUB_ADMIN = 'SUB_ADMIN',
  LAB_ASSISTANT = 'LAB_ASSISTANT',
}

export enum UserStatus {
  INVITED = 'INVITED', // created, password not set yet
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export enum LocationType {
  CAMPUS = 'CAMPUS',
  BUILDING = 'BUILDING',
  FLOOR = 'FLOOR',
  LAB = 'LAB', // lab or room — tickets are raised against this level
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REOPENED = 'REOPENED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TicketSource {
  PORTAL = 'PORTAL',
  WHATSAPP = 'WHATSAPP',
}

export enum Visibility {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL', // staff only, never sent to the lab assistant or WhatsApp
}

export enum TicketEventKind {
  CREATED = 'CREATED',
  STATUS = 'STATUS',
  ASSIGNED = 'ASSIGNED',
  MESSAGE = 'MESSAGE',
  ESCALATION = 'ESCALATION',
  PRIORITY = 'PRIORITY',
  ATTACHMENT = 'ATTACHMENT',
}
