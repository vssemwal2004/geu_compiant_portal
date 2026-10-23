import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppConfig } from '../config/app-config.service';
import type { AuthUser } from '../common/auth-user';
import { IS_PUBLIC, ROLES } from '../common/decorators';
import { Role } from '../common/enums';
import { AuthService } from './auth.service';

/** Global: every route needs a valid session cookie unless marked @Public(). */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = req.cookies?.[this.config.session.cookieName] as string | undefined;
    const user = await this.auth.resolveSession(token);
    if (!user) throw new UnauthorizedException('Please sign in.');
    req.user = user;
    return true;
  }
}

/** Global: enforces @Roles(...) — permissions live in the backend, not only in React. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('You do not have access to this action.');
    return true;
  }
}
