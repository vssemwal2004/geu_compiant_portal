import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppConfig } from '../config/app-config.service';
import { AuthUser } from '../common/auth-user';
import { UserStatus } from '../common/enums';
import { hashToken, newToken } from '../common/tokens';
import { User } from '../users/user.schema';
import { AccountLink, AccountLinkPurpose } from './account-link.schema';
import { hashPassword, passwordProblem, verifyPassword } from './password';
import { Session } from './session.schema';

const GENERIC_LOGIN_ERROR = 'Those credentials did not match an active account.';

@Injectable()
export class AuthService implements OnModuleInit {
  /** Used to spend the same time on unknown accounts, so response time does not reveal which emails exist. */
  private dummyHash = '';

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Session.name) private readonly sessions: Model<Session>,
    @InjectModel(AccountLink.name) private readonly links: Model<AccountLink>,
    private readonly config: AppConfig,
  ) {}

  async onModuleInit() {
    this.dummyHash = await hashPassword(newToken(16));
  }

  /** Email or employee ID + password → new session token (to be set as an HttpOnly cookie). */
  async login(identifier: string, password: string, meta: { ip?: string; userAgent?: string }) {
    const id = identifier.trim();
    const user = await this.users
      .findOne({ $or: [{ email: id.toLowerCase() }, { employeeId: id.toUpperCase() }] })
      .select('+passwordHash');

    const ok = await verifyPassword(user?.passwordHash ?? this.dummyHash, password);
    if (!user || !ok || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException(GENERIC_LOGIN_ERROR);

    const token = newToken();
    const expiresAt = new Date(Date.now() + this.config.session.ttlHours * 3_600_000);
    await this.sessions.create({ tokenHash: hashToken(token), userId: user._id, expiresAt, ...meta });
    user.lastLoginAt = new Date();
    await user.save();

    return { token, expiresAt, user: this.publicUser(user) };
  }

  async logout(token: string | undefined) {
    if (token) await this.sessions.deleteOne({ tokenHash: hashToken(token) });
  }

  /** Revoke every session of a user (deactivation, password change). */
  async revokeAll(userId: Types.ObjectId, exceptSessionId?: Types.ObjectId) {
    await this.sessions.deleteMany({ userId, ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}) });
  }

  /** Cookie token → signed-in user, or null. The account must still be active on every request. */
  async resolveSession(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null;
    const session = await this.sessions.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
    if (!session) return null;
    const user = await this.users.findById(session.userId).lean();
    if (!user || user.status !== UserStatus.ACTIVE) return null;
    return {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      allowedLocationIds: user.allowedLocationIds ?? [],
      sessionId: session._id,
    };
  }

  async changePassword(auth: AuthUser, current: string, next: string) {
    const user = await this.users.findById(auth.id).select('+passwordHash');
    if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, current)))
      throw new BadRequestException('Current password is incorrect.');
    this.assertPasswordOk(next);
    user.passwordHash = await hashPassword(next);
    await user.save();
    await this.revokeAll(user._id, auth.sessionId);
  }

  /** Create a one-time invite / reset link. Returns the URL to hand to the user (shown once). */
  async issueAccountLink(userId: Types.ObjectId, purpose: AccountLinkPurpose, createdBy?: Types.ObjectId) {
    await this.links.deleteMany({ userId, usedAt: { $exists: false } }); // only the newest link works
    const token = newToken();
    const expiresAt = new Date(Date.now() + this.config.accountLinkTtlHours * 3_600_000);
    await this.links.create({ tokenHash: hashToken(token), userId, purpose, expiresAt, createdBy });
    return { url: `${this.config.portalUrl}/set-password?token=${token}`, expiresAt };
  }

  /** Consume an invite / reset link: sets the password and activates an invited account. */
  async setPasswordWithLink(token: string, password: string) {
    const link = await this.links.findOne({ tokenHash: hashToken(token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
    if (!link) throw new BadRequestException('This link is invalid or has expired. Ask the Main Admin for a new one.');
    this.assertPasswordOk(password);

    const user = await this.users.findById(link.userId);
    if (!user || user.status === UserStatus.DISABLED) throw new BadRequestException('This account is not active.');

    user.passwordHash = await hashPassword(password);
    if (user.status === UserStatus.INVITED) user.status = UserStatus.ACTIVE;
    await user.save();
    link.usedAt = new Date();
    await link.save();
    await this.revokeAll(user._id);
  }

  private assertPasswordOk(password: string) {
    const problem = passwordProblem(password, this.config.passwordMinLength);
    if (problem) throw new BadRequestException(problem);
  }

  publicUser(user: { _id: Types.ObjectId; name: string; email: string; employeeId: string; role: string; title?: string; allowedLocationIds?: Types.ObjectId[]; phoneE164?: string }) {
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      role: user.role,
      title: user.title,
      phoneE164: user.phoneE164,
      allowedLocationIds: user.allowedLocationIds ?? [],
    };
  }
}
