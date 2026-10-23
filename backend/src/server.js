const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const argon2 = require('argon2');
const config = require('./config');
const { User, Location, AssetType } = require('./models');
const { requireAuth } = require('./middleware/auth');
const { mainAdmin } = require('./services/common');

function createApp() {
  const app = express();
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin(origin, callback) { callback(null, !origin || config.frontendOrigins.includes(origin)); }, credentials: true }));
  // The webhook needs exact bytes for HMAC verification, before the JSON parser runs.
  app.use(`${config.prefix}/webhooks/whatsapp`, require('./routes/webhook'));
  app.use(express.json({ limit: '7mb' }));
  app.use(cookieParser());
  app.get(`${config.prefix}/health`, (_req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ status: mongoose.connection.readyState === 1 ? 'ok' : 'database unavailable' }));
  app.use(`${config.prefix}/auth`, require('./routes/auth'));
  const api = express.Router();
  api.use(requireAuth);
  api.use('/reference', require('./routes/reference'));
  api.use('/locations', require('./routes/locations'));
  api.use('/asset-types', require('./routes/assets'));
  api.use('/routing', require('./routes/routing'));
  api.use('/tickets', require('./routes/tickets'));
  api.use('/uploads', require('./routes/uploads'));
  api.use('/admin/users', require('./routes/users'));
  api.use('/admin/locations', require('./routes/locations'));
  api.use('/admin/asset-types', require('./routes/assets'));
  api.use('/admin/roles', mainAdmin, require('./routes/roles'));
  api.use('/admin/reports', mainAdmin, require('./routes/reports'));
  api.use('/admin/audit-logs', mainAdmin, require('./routes/audit'));
  api.use('/admin/escalations', mainAdmin, require('./routes/escalations'));
  app.use(config.prefix, api);
  app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
  app.use((cause, _req, res, _next) => {
    if (cause.status) return res.status(cause.status).json({ message: cause.message });
    if (cause.code === 11000) return res.status(409).json({ message: 'A record with that value already exists.' });
    if (cause.name === 'ValidationError' || cause.name === 'CastError') return res.status(400).json({ message: cause.message });
    console.error(cause);
    res.status(500).json({ message: 'Internal server error.' });
  });
  return app;
}
async function seedAdmin() {
  let admin = await User.findOne({ role: 'MAIN_ADMIN' }).select('+passwordHash');
  if (admin) return;
  if (!config.admin.email || !config.admin.password || config.admin.password.length < 10) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (10+ characters) in backend/.env for the first start.');
  admin = await User.create({ id: require('node:crypto').randomUUID(), name: config.admin.name, email: config.admin.email,
    employeeId: config.admin.employeeId, role: 'MAIN_ADMIN', title: 'Administrator', status: 'ACTIVE', passwordHash: await argon2.hash(config.admin.password) });
  console.log(`Main Admin account created for ${admin.email}`);
}
async function seedReference() {
  if (!config.seedReference) return;
  const reference = require('../data/reference.json');
  for (const location of reference.locations) await Location.updateOne({ id: location.id }, { $setOnInsert: location }, { upsert: true });
  for (const asset of reference.assetTypes) await AssetType.updateOne({ id: asset.id }, { $setOnInsert: asset }, { upsert: true });
}
async function start() {
  if (!config.mongoUri || !/^mongodb(\+srv)?:\/\//.test(config.mongoUri)) throw new Error('Set MONGODB_URI in backend/.env.');
  await mongoose.connect(config.mongoUri, { dbName: config.mongoDb, serverSelectionTimeoutMS: 10000, autoIndex: true });
  await seedAdmin();
  await seedReference();
  return createApp();
}
if (require.main === module) {
  start().then(app => {
    const server = app.listen(config.port, () => console.log(`API ready at http://localhost:${config.port}${config.prefix}`));
    server.on('error', cause => { console.error('Could not start API:', cause.message); process.exitCode = 1; });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => mongoose.disconnect().finally(() => process.exit(0))));
  }).catch(cause => { console.error('Could not initialize API:', cause.message); process.exitCode = 1; mongoose.disconnect().catch(() => {}); });
}
module.exports = { createApp, start, seedAdmin };
