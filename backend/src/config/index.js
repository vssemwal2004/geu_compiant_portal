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
    name: process.env.SEED_ADMIN_NAME || 'Main Admin',
    email: process.env.SEED_ADMIN_EMAIL,
    employeeId: process.env.SEED_ADMIN_EMPLOYEE_ID || 'GEU-A-001',
    password: process.env.SEED_ADMIN_PASSWORD,
  },
  seedReference: process.env.SEED_REFERENCE_DATA === 'true',
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    graphVersion: process.env.WHATSAPP_API_VERSION || 'v26.0',
    graphBase: process.env.WHATSAPP_GRAPH_URL || 'https://graph.facebook.com',
    statusTemplate: process.env.WHATSAPP_STATUS_TEMPLATE || '',
  },
};
module.exports = config;
