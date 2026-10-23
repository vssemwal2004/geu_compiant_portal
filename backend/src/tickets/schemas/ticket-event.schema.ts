import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TicketEventKind, Visibility } from '../../common/enums';

/**
 * Append-only ticket history: creation, status changes, assignments, messages, escalations.
 * One collection replaces the PDF's ticket_messages / ticket_status_history /
 * ticket_assignment_history tables so the timeline is a single ordered query.
 */
@Schema({ collection: 'ticket_events', timestamps: { createdAt: true, updatedAt: false } })
export class TicketEvent {
  @Prop({ type: Types.ObjectId, ref: 'Ticket', required: true })
  ticketId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(TicketEventKind) })
  kind: TicketEventKind;

  /** null for system actions (auto-routing, auto-close). */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  actorId: Types.ObjectId | null;

  /** STATUS: previous/next status. ASSIGNED: previous/next assignee id (as string). */
  @Prop({ type: String, default: null })
  from: string | null;

  @Prop({ type: String, default: null })
  to: string | null;

  @Prop({ trim: true, maxlength: 2000 })
  text?: string;

  @Prop({ required: true, enum: Object.values(Visibility), default: Visibility.PUBLIC })
  visibility: Visibility;

  @Prop({ enum: ['PORTAL', 'WHATSAPP', 'SYSTEM'], default: 'PORTAL' })
  channel: 'PORTAL' | 'WHATSAPP' | 'SYSTEM';

  @Prop({ type: Types.ObjectId, ref: 'RoutingRule' })
  ruleId?: Types.ObjectId;

  /** WhatsApp message id when the event came from / went to WhatsApp. */
  @Prop()
  externalMessageId?: string;

  createdAt: Date;
}

export type TicketEventDocument = HydratedDocument<TicketEvent>;
export const TicketEventSchema = SchemaFactory.createForClass(TicketEvent);
TicketEventSchema.index({ ticketId: 1, createdAt: 1 });
