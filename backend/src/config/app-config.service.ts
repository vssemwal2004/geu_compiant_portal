import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TicketPriority } from '../common/enums';

/** Typed, read-only access to validated configuration. */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService) {}

  private get<T>(key: string): T {
    return this.config.get<T>(key) as T;
  }

  get isProduction() {
    return this.get<string>('NODE_ENV') === 'production';
  }

  get port() {
    return this.get<number>('PORT');
  }

  get apiPrefix() {
    return this.get<string>('API_PREFIX');
  }

  get trustProxy() {
    return this.get<boolean>('TRUST_PROXY');
  }

  get frontendOrigins(): string[] {
    return this.get<string>('FRONTEND_ORIGIN')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  get portalUrl() {
    return this.get<string>('PORTAL_URL').replace(/\/$/, '');
  }

  get mongo() {
    return { uri: this.get<string>('MONGODB_URI'), dbName: this.get<string>('MONGODB_DB_NAME') };
  }

  get session() {
    return {
      cookieName: this.get<string>('SESSION_COOKIE_NAME'),
      ttlHours: this.get<number>('SESSION_TTL_HOURS'),
      secure: this.get<boolean>('COOKIE_SECURE'),
      sameSite: this.get<'lax' | 'strict' | 'none'>('COOKIE_SAMESITE'),
      domain: this.get<string>('COOKIE_DOMAIN') || undefined,
    };
  }

  get passwordMinLength() {
    return this.get<number>('PASSWORD_MIN_LENGTH');
  }

  get accountLinkTtlHours() {
    return this.get<number>('ACCOUNT_LINK_TTL_HOURS');
  }

  get rateLimit() {
    return {
      perMinute: this.get<number>('RATE_LIMIT_PER_MINUTE'),
      loginPerMinute: this.get<number>('LOGIN_RATE_LIMIT_PER_MINUTE'),
    };
  }

  get disputeWindowHours() {
    return this.get<number>('DISPUTE_WINDOW_HOURS');
  }

  get slaHours(): Record<TicketPriority, number> {
    return {
      [TicketPriority.CRITICAL]: this.get<number>('SLA_HOURS_CRITICAL'),
      [TicketPriority.HIGH]: this.get<number>('SLA_HOURS_HIGH'),
      [TicketPriority.MEDIUM]: this.get<number>('SLA_HOURS_MEDIUM'),
      [TicketPriority.LOW]: this.get<number>('SLA_HOURS_LOW'),
    };
  }

  get storage() {
    const s = {
      region: this.get<string>('S3_REGION'),
      bucket: this.get<string>('S3_BUCKET'),
      endpoint: this.get<string>('S3_ENDPOINT') || undefined,
      accessKeyId: this.get<string>('S3_ACCESS_KEY_ID'),
      secretAccessKey: this.get<string>('S3_SECRET_ACCESS_KEY'),
      forcePathStyle: this.get<boolean>('S3_FORCE_PATH_STYLE'),
      maxBytes: this.get<number>('UPLOAD_MAX_MB') * 1024 * 1024,
      signedUrlTtl: this.get<number>('SIGNED_URL_TTL_SECONDS'),
    };
    return { ...s, configured: !!(s.region && s.bucket && s.accessKeyId && s.secretAccessKey) };
  }

  get whatsapp() {
    const w = {
      verifyToken: this.get<string>('WHATSAPP_VERIFY_TOKEN'),
      appSecret: this.get<string>('WHATSAPP_APP_SECRET'),
      accessToken: this.get<string>('WHATSAPP_ACCESS_TOKEN'),
      phoneNumberId: this.get<string>('WHATSAPP_PHONE_NUMBER_ID'),
      graphUrl: this.get<string>('WHATSAPP_GRAPH_URL'),
      apiVersion: this.get<string>('WHATSAPP_API_VERSION'),
    };
    return { ...w, webhookConfigured: !!(w.verifyToken && w.appSecret) };
  }

  get seedAdmin() {
    return {
      name: this.get<string>('SEED_ADMIN_NAME'),
      email: this.get<string>('SEED_ADMIN_EMAIL'),
      employeeId: this.get<string>('SEED_ADMIN_EMPLOYEE_ID'),
      password: this.get<string>('SEED_ADMIN_PASSWORD'),
    };
  }
}
