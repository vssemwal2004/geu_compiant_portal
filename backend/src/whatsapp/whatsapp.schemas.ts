import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum WaEventStatus {
  RECEIVED = 'RECEIVED',
  PROCESSED = 'PROCESSED',
  IGNORED_UNREGISTERED = 'IGNORED_UNREGISTERED', // sender is not an active, verified lab assistant
  FAILED = 'FAILED',
}

/** Every inbound WhatsApp message, keyed by Meta's message id — retries are deduplicated here. */
@Schema({ collection: 'whatsapp_events', timestamps: true })
export class WhatsappEvent {
  @Prop({ required: true, unique: true })
  providerMessageId: string;

  @Prop({ required: true, enum: ['IN', 'OUT'] })
  direction: 'IN' | 'OUT';

  /** Sender in E.164 */
  @Prop({ index: true })
  fromE164?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop()
  messageType?: string;

  @Prop({ type: Object })
  payload: Record<string, unknown>;

  @Prop({ enum: Object.values(WaEventStatus), default: WaEventStatus.RECEIVED, index: true })
  processingStatus: WaEventStatus;

  @Prop()
  error?: string;
}
export type WhatsappEventDocument = HydratedDocument<WhatsappEvent>;
export const WhatsappEventSchema = SchemaFactory.createForClass(WhatsappEvent);

/** Bot conversation states (PDF §6). */
export enum BotState {
  IDLE = 'IDLE',
  WAIT_IMAGE = 'WAIT_IMAGE',
  WAIT_ASSET = 'WAIT_ASSET',
  WAIT_LOCATION = 'WAIT_LOCATION',
  WAIT_DESCRIPTION = 'WAIT_DESCRIPTION',
  CONFIRM = 'CONFIRM',
}

/** One live conversation per lab assistant; expires automatically when idle. */
@Schema({ collection: 'whatsapp_sessions', timestamps: true })
export class WhatsappSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ enum: Object.values(BotState), default: BotState.IDLE })
  state: BotState;

  /** Draft ticket being built: storageKey, assetTypeId, locationId, description. */
  @Prop({ type: Object, default: {} })
  draft: Record<string, unknown>;

  /** Doubles as the ticket idempotency key, so a repeated "Confirm" cannot create two tickets. */
  @Prop()
  draftId?: string;

  @Prop({ required: true })
  expiresAt: Date;
}
export type WhatsappSessionDocument = HydratedDocument<WhatsappSession>;
export const WhatsappSessionSchema = SchemaFactory.createForClass(WhatsappSession);
WhatsappSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
