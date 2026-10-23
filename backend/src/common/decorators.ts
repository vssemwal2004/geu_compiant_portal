import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth-user';
import { Role } from './enums';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Route needs no session (login, webhooks, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route is limited to these roles. Without it, any signed-in user may call the route. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** Injects the signed-in user. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
  return req.user;
});
