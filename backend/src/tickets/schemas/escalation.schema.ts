import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum EscalationStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

/** Sub-Admin asks the Main Admin to reassign or intervene (PDF §10.08). */
@Schema({ collection: 'escalation_requests', timestamps: true })
export class Escalation {
  @Prop({ type: Types.ObjectId, ref: 'Ticket', required: true, index: true })
  ticketId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requestedBy: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  reason: string;

  @Prop({ enum: Object.values(EscalationStatus), default: EscalationStatus.OPEN, index: true })
  status: EscalationStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId;

  @Prop()
  resolvedAt?: Date;
}

export type EscalationDocument = HydratedDocument<Escalation>;
export const EscalationSchema = SchemaFactory.createForClass(Escalation);
