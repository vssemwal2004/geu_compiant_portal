import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { SkipThrottle } from '@nestjs/throttler';
import { Connection } from 'mongoose';
import { Public } from '../common/decorators';
import { AppConfig } from '../config/app-config.service';

@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(
    @InjectConnection() private readonly conn: Connection,
    private readonly config: AppConfig,
  ) {}

  /** Liveness + which integrations are configured (never returns secrets). */
  @Get()
  check() {
    return {
      status: 'ok',
      database: this.conn.readyState === 1 ? 'up' : 'down',
      storage: this.config.storage.configured ? 'configured' : 'not-configured',
      whatsapp: this.config.whatsapp.webhookConfigured ? 'configured' : 'not-configured',
      time: new Date().toISOString(),
    };
  }
}
