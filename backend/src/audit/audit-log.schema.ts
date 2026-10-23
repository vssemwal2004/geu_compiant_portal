import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Who did what to which record. Written in the same transaction as the change itself. */
@Schema({ collection: 'audit_logs', timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  actorId: Types.ObjectId | null;

  /** e.g. ticket.create, ticket.status, user.create, routing.create */
  @Prop({ required: true, index: true })
  action: string;

  @Prop({ required: true })
  entityType: string;

  @Prop({ type: Types.ObjectId, required: true })
  entityId: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  @Prop()
  ip?: string;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });
