const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: Number(process.env.PORT || 4000),
  prefix: `/${(process.env.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '')}`,
  mongoUri: process.env.MONGODB_URI,
  mongoDb: process.env.MONGODB_DB_NAME || 'geu_complaint_portal',
  frontendOrigins: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean),
  cookieName: process.env.SESSION_COOKIE_NAME || 'geu_sid',
  sessionHours: Number(process.env.SESSION_TTL_HOURS || 12),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  admin: {
    name: process.env.SEED_ADMIN_NAME || 'Super Admin',
    email: process.env.SEED_ADMIN_EMAIL,
    employeeId: process.env.SEED_ADMIN_EMPLOYEE_ID || 'GEU-A-001',
    phone: process.env.SEED_ADMIN_MOBILE,
    password: process.env.SEED_ADMIN_PASSWORD,
  },
  seedReference: process.env.SEED_REFERENCE_DATA === 'true',
  msg91: {
    authKey: process.env.SMS_API_KEY || process.env.MSG91_AUTH_KEY,
    templateId: process.env.SMS_TEMPLATE_ID || process.env.MSG91_SMS_TEMPLATE_ID,
    senderId: process.env.SMS_SENDER_ID,
    baseUrl: process.env.MSG91_SMS_URL || 'https://control.msg91.com/api/v5/flow',
  },
};
module.exports = config;
