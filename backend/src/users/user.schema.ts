import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role, UserStatus } from '../common/enums';

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  employeeId: string;

  @Prop({ required: true, enum: Object.values(Role) })
  role: Role;

  @Prop({ trim: true, maxlength: 80 })
  title?: string;

  /** E.164; the WhatsApp bot only answers numbers that are registered, verified and active. */
  @Prop({ trim: true })
  phoneE164?: string;

  @Prop()
  phoneVerifiedAt?: Date;

  @Prop({ select: false })
  passwordHash?: string;

  /** Lab Assistants only — access to a location covers everything beneath it. */
  @Prop({ type: [Types.ObjectId], ref: 'Location', default: [] })
  allowedLocationIds: Types.ObjectId[];

  @Prop({ enum: Object.values(UserStatus), default: UserStatus.INVITED, index: true })
  status: UserStatus;

  @Prop()
  lastLoginAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ role: 1, status: 1 });
// Unique only when present, so many users can have no phone yet.
UserSchema.index(
  { phoneE164: 1 },
  { unique: true, partialFilterExpression: { phoneE164: { $type: 'string' } } },
);
