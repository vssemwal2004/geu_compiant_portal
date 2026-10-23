import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export enum AccountLinkPurpose {
  INVITE = 'INVITE', // first password for a new account
  RESET = 'RESET', // admin-issued password reset
}

/** One-time link to set a password. Only the token hash is stored. */
@Schema({ collection: 'account_links', timestamps: true })
export class AccountLink {
  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(AccountLinkPurpose) })
  purpose: AccountLinkPurpose;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  usedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export type AccountLinkDocument = HydratedDocument<AccountLink>;
export const AccountLinkSchema = SchemaFactory.createForClass(AccountLink);
AccountLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
