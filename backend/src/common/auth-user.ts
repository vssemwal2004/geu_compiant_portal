import { Types } from 'mongoose';
import { Role } from './enums';

/** The signed-in user attached to each authenticated request. */
export interface AuthUser {
  id: Types.ObjectId;
  role: Role;
  name: string;
  email: string;
  allowedLocationIds: Types.ObjectId[];
  sessionId: Types.ObjectId;
}
