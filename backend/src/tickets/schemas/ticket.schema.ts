import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TicketPriority, TicketSource, TicketStatus } from '../../common/enums';

export enum AttachmentKind {
  ISSUE = 'ISSUE', // photo of the problem, added by the creator
  EVIDENCE = 'EVIDENCE', // completion evidence, added by staff
}

@Schema({ _id: true, timestamps: { createdAt: true, updatedAt: false } })
export class Attachment {
  @Prop({ required: true })
  storageKey: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop()
  sizeBytes?: number;

  @Prop({ enum: Object.values(AttachmentKind), default: AttachmentKind.ISSUE })
  kind: AttachmentKind;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploaderId: Types.ObjectId;
}
export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

@Schema({ collection: 'tickets', timestamps: true })
export class Ticket {
  /** Human ticket code, e.g. GEU-2026-000187 */
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creatorId: Types.ObjectId;

  /** Lab/room the ticket is about. */
  @Prop({ type: Types.ObjectId, ref: 'Location', required: true })
  locationId: Types.ObjectId;

  /** locationId plus all its ancestors — lets dashboards filter by building/floor cheaply. */
  @Prop({ type: [Types.ObjectId], ref: 'Location', default: [], index: true })
  locationPath: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'AssetType', required: true, index: true })
  assetTypeId: Types.ObjectId;

  /** Assignment is independent of status: an OPEN ticket can be unassigned. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assignedTo: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'RoutingRule', default: null })
  routingRuleId: Types.ObjectId | null;

  @Prop({ required: true, enum: Object.values(TicketStatus), default: TicketStatus.OPEN })
  status: TicketStatus;

  @Prop({ required: true, enum: Object.values(TicketPriority) })
  priority: TicketPriority;

  @Prop({ required: true, enum: Object.values(TicketSource) })
  source: TicketSource;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  description: string;

  @Prop({ type: [AttachmentSchema], default: [] })
  attachments: Attachment[];

  @Prop({ required: true })
  dueAt: Date;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  closedAt?: Date;

  /** Client-supplied key so retries / double taps never create a second ticket. */
  @Prop()
  idempotencyKey?: string;

  createdAt: Date;
  updatedAt: Date;
}

export type TicketDocument = HydratedDocument<Ticket>;
export const TicketSchema = SchemaFactory.createForClass(Ticket);

TicketSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
TicketSchema.index({ creatorId: 1, createdAt: -1 });
TicketSchema.index({ status: 1, dueAt: 1 });
TicketSchema.index(
  { creatorId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
TicketSchema.index({ code: 'text', description: 'text' });
