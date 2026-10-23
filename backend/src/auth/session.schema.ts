import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Server-side session; the cookie holds only a random token whose SHA-256 is stored here. */
@Schema({ collection: 'sessions', timestamps: true })
export class Session {
  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);
// MongoDB removes expired sessions automatically.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
