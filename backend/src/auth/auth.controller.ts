import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AppConfig } from '../config/app-config.service';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, Public } from '../common/decorators';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { AuthService } from './auth.service';

// Resolved per request from the validated environment (ConfigModule loads .env into process.env).
const loginLimit = { default: { limit: () => Number(process.env.LOGIN_RATE_LIMIT_PER_MINUTE ?? 10), ttl: 60_000 } };

class LoginDto {
  /** University email or employee ID */
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

class SetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  @Public()
  @Throttle(loginLimit)
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { token, expiresAt, user } = await this.auth.login(dto.identifier, dto.password, {
      ip: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 200),
    });
    const s = this.config.session;
    res.cookie(s.cookieName, token, {
      httpOnly: true,
      secure: s.secure,
      sameSite: s.sameSite,
      domain: s.domain,
      expires: expiresAt,
      path: '/',
    });
    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const s = this.config.session;
    await this.auth.logout(req.cookies?.[s.cookieName]);
    res.clearCookie(s.cookieName, { path: '/', domain: s.domain });
  }

  /** Who am I — the portal calls this on load to restore the session and pick the dashboard. */
  @Get('me')
  async me(@CurrentUser() current: AuthUser) {
    const user = await this.users.findById(current.id).lean();
    return { user: user ? this.auth.publicUser(user) : null };
  }

  /** Invite / reset link → first or new password. */
  @Public()
  @Throttle(loginLimit)
  @Post('set-password')
  @HttpCode(204)
  async setPassword(@Body() dto: SetPasswordDto) {
    await this.auth.setPasswordWithLink(dto.token, dto.password);
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user, dto.currentPassword, dto.newPassword);
  }
}
