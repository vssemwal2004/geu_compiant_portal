import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum OutboxChannel {
  WHATSAPP = 'WHATSAPP',
  PORTAL = 'PORTAL',
}

export enum OutboxStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED', // will retry
  DEAD = 'DEAD', // gave up after max retries
}

/**
 * Transactional outbox: notifications are written in the same transaction as the ticket change,
 * then delivered by a worker (Phase 4). A crash can never lose or duplicate a notification.
 */
@Schema({ collection: 'notification_outbox', timestamps: true })
export class OutboxMessage {
  @Prop({ type: Types.ObjectId, ref: 'Ticket', index: true })
  ticketId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipientId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(OutboxChannel) })
  channel: OutboxChannel;

  /** e.g. ticket.created, ticket.assigned, ticket.resolved */
  @Prop({ required: true })
  type: string;

  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  @Prop({ enum: Object.values(OutboxStatus), default: OutboxStatus.PENDING })
  status: OutboxStatus;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop({ default: () => new Date() })
  nextAttemptAt: Date;

  @Prop()
  providerMessageId?: string;

  /** Latest delivery receipt from WhatsApp: sent / delivered / read / failed */
  @Prop()
  deliveryStatus?: string;

  @Prop()
  lastError?: string;
}

export type OutboxDocument = HydratedDocument<OutboxMessage>;
export const OutboxSchema = SchemaFactory.createForClass(OutboxMessage);
OutboxSchema.index({ status: 1, nextAttemptAt: 1 });
OutboxSchema.index(
  { providerMessageId: 1 },
  { unique: true, partialFilterExpression: { providerMessageId: { $type: 'string' } } },
);
