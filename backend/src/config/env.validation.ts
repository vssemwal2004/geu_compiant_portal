import * as Joi from 'joi';

/**
 * Every environment variable the API reads. The app refuses to start if a required one
 * is missing or malformed, so misconfiguration fails fast instead of at first request.
 * Optional integrations (S3 storage, WhatsApp) may stay empty until you are ready;
 * their endpoints then answer 503 "not configured".
 */
export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(4000),
  API_PREFIX: Joi.string().default('api/v1'),
  TRUST_PROXY: Joi.boolean().default(false),

  // Comma-separated list of portal origins allowed to call the API with cookies.
  FRONTEND_ORIGIN: Joi.string().required(),
  // Public URL of the portal, used to build invite / password links.
  PORTAL_URL: Joi.string().uri().required(),

  // MongoDB Atlas connection string (replica set required for transactions).
  MONGODB_URI: Joi.string()
    .pattern(/^mongodb(\+srv)?:\/\//)
    .required()
    .messages({ 'string.pattern.base': 'MONGODB_URI must start with mongodb:// or mongodb+srv://' }),
  MONGODB_DB_NAME: Joi.string().default('geu_complaint_portal'),

  // Session cookie
  SESSION_COOKIE_NAME: Joi.string().default('geu_sid'),
  SESSION_TTL_HOURS: Joi.number().integer().min(1).max(720).default(12),
  COOKIE_SECURE: Joi.boolean().default(false),
  COOKIE_SAMESITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
  COOKIE_DOMAIN: Joi.string().allow('').default(''),

  // Passwords & account links
  PASSWORD_MIN_LENGTH: Joi.number().integer().min(8).default(10),
  ACCOUNT_LINK_TTL_HOURS: Joi.number().integer().min(1).default(72),

  // Rate limits (requests per minute)
  RATE_LIMIT_PER_MINUTE: Joi.number().integer().min(10).default(120),
  LOGIN_RATE_LIMIT_PER_MINUTE: Joi.number().integer().min(1).default(10),

  // Ticket policy
  DISPUTE_WINDOW_HOURS: Joi.number().integer().min(1).default(72),
  SLA_HOURS_CRITICAL: Joi.number().integer().min(1).default(4),
  SLA_HOURS_HIGH: Joi.number().integer().min(1).default(24),
  SLA_HOURS_MEDIUM: Joi.number().integer().min(1).default(48),
  SLA_HOURS_LOW: Joi.number().integer().min(1).default(96),

  // Image storage (S3 or S3-compatible such as MinIO / Cloudflare R2). Optional until configured.
  S3_REGION: Joi.string().allow('').default(''),
  S3_BUCKET: Joi.string().allow('').default(''),
  S3_ENDPOINT: Joi.string().allow('').default(''),
  S3_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  S3_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(false),
  UPLOAD_MAX_MB: Joi.number().min(1).max(25).default(5),
  SIGNED_URL_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(300),

  // WhatsApp Cloud API (Meta). Optional until configured.
  WHATSAPP_VERIFY_TOKEN: Joi.string().allow('').default(''),
  WHATSAPP_APP_SECRET: Joi.string().allow('').default(''),
  WHATSAPP_ACCESS_TOKEN: Joi.string().allow('').default(''),
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().allow('').default(''),
  WHATSAPP_GRAPH_URL: Joi.string().uri().default('https://graph.facebook.com'),
  WHATSAPP_API_VERSION: Joi.string().default('v21.0'),

  // First Main Admin, used only by `npm run seed:admin`
  SEED_ADMIN_NAME: Joi.string().allow('').default('Main Admin'),
  SEED_ADMIN_EMAIL: Joi.string().email().allow('').default(''),
  SEED_ADMIN_EMPLOYEE_ID: Joi.string().allow('').default(''),
  SEED_ADMIN_PASSWORD: Joi.string().allow('').default(''),
});
