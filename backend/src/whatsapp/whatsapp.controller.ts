import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AppConfig } from '../config/app-config.service';
import { Public } from '../common/decorators';
import { safeEqual } from '../common/tokens';
import { isValidMetaSignature } from './signature';
import { WhatsappService } from './whatsapp.service';

@Controller('webhooks/whatsapp')
@Public()
@SkipThrottle()
export class WhatsappController {
  constructor(
    private readonly config: AppConfig,
    private readonly whatsapp: WhatsappService,
  ) {}

  /** Meta's one-time subscription check: echo hub.challenge when the verify token matches. */
  @Get()
  verify(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    const { verifyToken } = this.config.whatsapp;
    if (!verifyToken) throw new ServiceUnavailableException('WhatsApp is not configured yet.');
    if (mode === 'subscribe' && token && safeEqual(token, verifyToken)) return challenge;
    throw new ForbiddenException();
  }

  /** Signed inbound events. Answer 200 fast — Meta retries on errors, and retries are deduplicated. */
  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature: string | undefined) {
    const { appSecret, webhookConfigured } = this.config.whatsapp;
    if (!webhookConfigured) throw new ServiceUnavailableException('WhatsApp is not configured yet.');
    if (!req.rawBody || !isValidMetaSignature(req.rawBody, signature, appSecret)) throw new UnauthorizedException('Invalid signature');
    await this.whatsapp.handleWebhook(req.body);
    return { received: true };
  }
}
