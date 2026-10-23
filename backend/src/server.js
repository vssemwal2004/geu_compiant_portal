require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const argon2 = require('argon2');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const app = express();
const dataFile = process.env.DATA_FILE || path.join(__dirname, '../data/store.json');
const reference = require('../data/reference.json');
const prefix = `/${(process.env.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '')}`;
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map(x => x.trim());
const cookieName = process.env.SESSION_COOKIE_NAME || 'geu_sid';
const sessionMs = Number(process.env.SESSION_TTL_HOURS || 12) * 3600000;
const sla = { CRITICAL: 4, HIGH: 24, MEDIUM: 48, LOW: 96 };
const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CLOSED', 'CANCELLED'];
const priorities = Object.keys(sla);
let db;

function save() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, dataFile);
}
function publicUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}
function fail(status, message) { const err = new Error(message); err.status = status; throw err; }
function requireText(value, name, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(400, `${name} is required (max ${max} characters).`);
  return value.trim();
}
function nextId() { return crypto.randomUUID(); }
function ancestorIds(id) {
  const ids = [];
  let current = db.locations.find(x => x.id === id);
  while (current && !ids.includes(current.id)) {
    ids.push(current.id);
    current = db.locations.find(x => x.id === current.parentId);
  }
  return ids;
}
function visible(user, ticket) {
  return user.role === 'MAIN_ADMIN' || (user.role === 'SUB_ADMIN' && ticket.assignedTo === user.id) ||
    (user.role === 'LAB_ASSISTANT' && ticket.creatorId === user.id);
}
function outputTicket(user, ticket) {
  return { ...ticket, events: ticket.events.filter(e => user.role !== 'LAB_ASSISTANT' || e.visibility === 'PUBLIC') };
}
function ticketFor(req) {
  const ticket = db.tickets.find(t => t.id === req.params.code);
  if (!ticket || !visible(req.user, ticket)) fail(404, 'Ticket not found.');
  return ticket;
}
function event(ticket, actorId, kind, fields = {}) {
  ticket.events.push({ id: nextId(), at: new Date().toISOString(), actorId, kind, visibility: 'PUBLIC', ...fields });
}
function cleanupSessions() {
  const now = Date.now();
  db.sessions = db.sessions.filter(s => Date.parse(s.expiresAt) > now);
}

if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.includes(origin)); }, credentials: true }));
app.use(express.json({ limit: '7mb' }));
app.use(cookieParser());
const api = express.Router();
app.use(prefix, api);

api.get('/health', (_req, res) => res.json({ status: 'ok' }));

const loginAttempts = new Map();
api.post('/auth/login', async (req, res) => {
  const identifier = requireText(req.body.identifier, 'identifier', 254).toLowerCase();
  const password = requireText(req.body.password, 'password', 128);
  const key = `${req.ip}:${identifier}`;
  const entry = loginAttempts.get(key) || { count: 0, until: 0 };
  if (entry.until > Date.now() && entry.count >= Number(process.env.LOGIN_RATE_LIMIT_PER_MINUTE || 10)) fail(429, 'Too many login attempts. Try again later.');
  const user = db.users.find(u => u.email.toLowerCase() === identifier || u.employeeId.toLowerCase() === identifier);
  if (!user || user.status !== 'ACTIVE' || !user.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
    loginAttempts.set(key, { count: entry.until > Date.now() ? entry.count + 1 : 1, until: Date.now() + 60000 });
    fail(401, 'Those credentials did not match an active account.');
  }
  loginAttempts.delete(key);
  cleanupSessions();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + sessionMs).toISOString();
  db.sessions.push({ tokenHash: crypto.createHash('sha256').update(token).digest('hex'), userId: user.id, expiresAt });
  user.lastLoginAt = new Date().toISOString();
  save();
  res.cookie(cookieName, token, { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: process.env.COOKIE_SAMESITE || 'lax', path: '/', expires: new Date(expiresAt) });
  res.json({ user: publicUser(user) });
});

api.use((req, _res, next) => {
  const token = req.cookies[cookieName];
  const hash = token && crypto.createHash('sha256').update(token).digest('hex');
  const session = hash && db.sessions.find(s => s.tokenHash === hash && Date.parse(s.expiresAt) > Date.now());
  const user = session && db.users.find(u => u.id === session.userId && u.status === 'ACTIVE');
  if (!user) return next(Object.assign(new Error('Sign in required.'), { status: 401 }));
  req.user = user;
  req.session = session;
  next();
});
api.get('/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));
api.post('/auth/logout', (req, res) => {
  db.sessions = db.sessions.filter(s => s !== req.session);
  save();
  res.clearCookie(cookieName, { path: '/' }).status(204).end();
});
api.post('/auth/change-password', async (req, res) => {
  if (!await argon2.verify(req.user.passwordHash, req.body.currentPassword || '')) fail(400, 'Current password is incorrect.');
  const password = requireText(req.body.newPassword, 'newPassword', 128);
  if (password.length < 10) fail(400, 'Password must be at least 10 characters.');
  req.user.passwordHash = await argon2.hash(password);
  db.sessions = db.sessions.filter(s => s === req.session || s.userId !== req.user.id);
  save();
  res.status(204).end();
});

api.get('/reference', (req, res) => res.json({
  users: db.users.filter(u => u.status === 'ACTIVE').map(publicUser), locations: db.locations.filter(x => x.active !== false),
  assetTypes: db.assetTypes.filter(x => x.active !== false), routingRules: db.routingRules.filter(x => x.active !== false && db.users.some(u => u.id === x.subAdminId && u.status === 'ACTIVE')),
}));
api.get('/locations', (req, res) => res.json(db.locations.filter(l => l.active !== false || (req.user.role === 'MAIN_ADMIN' && req.query.includeInactive === 'true'))));
api.get('/locations/permitted', (req, res) => res.json(db.locations.filter(l => l.active !== false && (req.user.role === 'MAIN_ADMIN' || ancestorIds(l.id).some(id => req.user.allowedLocationIds?.includes(id))))));
api.get('/asset-types', (_req, res) => res.json(db.assetTypes.filter(a => a.active !== false)));
api.get('/routing/preview', (req, res) => {
  const rule = ancestorIds(req.query.locationId).map(id => db.routingRules.find(r => r.active && r.locationId === id && r.assetTypeId === req.query.assetTypeId && db.users.some(u => u.id === r.subAdminId && u.status === 'ACTIVE'))).find(Boolean);
  res.json(rule ? { assigneeId: rule.subAdminId, ruleId: rule.id, ruleLocationId: rule.locationId } : { assigneeId: null });
});

api.get('/tickets', (req, res) => res.json(db.tickets.filter(t => visible(req.user, t)).map(t => outputTicket(req.user, t)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
api.get('/tickets/summary', (req, res) => {
  const tickets = db.tickets.filter(t => visible(req.user, t));
  res.json({ total: tickets.length, byStatus: Object.fromEntries(statuses.map(s => [s, tickets.filter(t => t.status === s).length])) });
});
api.get('/tickets/:code', (req, res) => res.json(outputTicket(req.user, ticketFor(req))));
api.post('/tickets', (req, res) => {
  if (!['MAIN_ADMIN', 'LAB_ASSISTANT'].includes(req.user.role)) fail(403, 'This role cannot create tickets.');
  const { locationId, assetTypeId } = req.body;
  const location = db.locations.find(l => l.id === locationId && l.active !== false && l.type === 'LAB');
  const asset = db.assetTypes.find(a => a.id === assetTypeId && a.active !== false);
  if (!location || !asset) fail(400, 'Choose a valid room and asset type.');
  const ancestry = ancestorIds(locationId);
  if (req.user.role === 'LAB_ASSISTANT' && !ancestry.some(id => req.user.allowedLocationIds?.includes(id))) fail(403, 'You cannot raise tickets for this location.');
  const description = requireText(req.body.description, 'description');
  const imageUrl = req.body.imageUrl;
  if (imageUrl && (typeof imageUrl !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(imageUrl) || imageUrl.length > 7_000_000)) fail(400, 'Invalid image.');
  const key = req.get('Idempotency-Key');
  const previous = key && db.tickets.find(t => t.creatorId === req.user.id && t.idempotencyKey === key);
  if (previous) return res.json(outputTicket(req.user, previous));
  const rule = ancestry.map(id => db.routingRules.find(r => r.active && r.locationId === id && r.assetTypeId === assetTypeId && db.users.some(u => u.id === r.subAdminId && u.status === 'ACTIVE'))).find(Boolean);
  const now = new Date();
  db.sequence = (db.sequence || 0) + 1;
  const ticket = { id: `GEU-${now.getFullYear()}-${String(db.sequence).padStart(6, '0')}`, creatorId: req.user.id, locationId, assetTypeId,
    assignedTo: rule?.subAdminId || null, routingRuleId: rule?.id || null, status: 'OPEN', priority: asset.defaultPriority, source: 'PORTAL',
    description, imageUrl, createdAt: now.toISOString(), dueAt: new Date(now.getTime() + sla[asset.defaultPriority] * 3600000).toISOString(),
    events: [], idempotencyKey: key || undefined };
  event(ticket, req.user.id, 'CREATED', { text: 'Ticket created' });
  if (ticket.assignedTo) event(ticket, null, 'ASSIGNED', { to: ticket.assignedTo });
  db.tickets.push(ticket); save();
  res.status(201).json(outputTicket(req.user, ticket));
});
api.patch('/tickets/:code/status', (req, res) => {
  const ticket = ticketFor(req);
  const to = req.body.to;
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  const isAdmin = req.user.role === 'MAIN_ADMIN';
  const worker = (req.user.role === 'SUB_ADMIN' && ticket.assignedTo === req.user.id) || (isAdmin && ticket.assignedTo);
  const creator = req.user.role === 'LAB_ASSISTANT' && ticket.creatorId === req.user.id;
  const from = ticket.status;
  const allowed = (worker && ((['OPEN', 'REOPENED'].includes(from) && to === 'IN_PROGRESS') || (from === 'IN_PROGRESS' && to === 'RESOLVED' && note))) ||
    (creator && from === 'RESOLVED' && (to === 'CLOSED' || (to === 'REOPENED' && note && Date.now() - Date.parse(ticket.events.findLast(e => e.to === 'RESOLVED')?.at || ticket.createdAt) < 72 * 3600000))) ||
    (isAdmin && ((from === 'CLOSED' && to === 'REOPENED' && note) || (!['CLOSED', 'CANCELLED'].includes(from) && to === 'CANCELLED' && note)));
  if (!allowed) fail(403, 'This status change is not permitted.');
  ticket.status = to;
  event(ticket, req.user.id, 'STATUS', { from, to, text: note || undefined });
  save(); res.json(outputTicket(req.user, ticket));
});
api.post('/tickets/:code/messages', (req, res) => {
  const ticket = ticketFor(req);
  if (['CLOSED', 'CANCELLED'].includes(ticket.status)) fail(400, 'This ticket is closed.');
  const body = requireText(req.body.body, 'body', 2000);
  const visibility = req.body.visibility === 'INTERNAL' ? 'INTERNAL' : 'PUBLIC';
  if (visibility === 'INTERNAL' && req.user.role === 'LAB_ASSISTANT') fail(403, 'Internal notes are staff only.');
  event(ticket, req.user.id, 'MESSAGE', { text: body, visibility });
  save(); res.json(outputTicket(req.user, ticket));
});
api.patch('/tickets/:code/assignee', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  const ticket = ticketFor(req);
  if (['CLOSED', 'CANCELLED'].includes(ticket.status)) fail(400, 'This ticket is closed.');
  const assignee = db.users.find(u => u.id === req.body.assigneeId && u.role === 'SUB_ADMIN' && u.status === 'ACTIVE');
  if (!assignee) fail(400, 'Choose an active Sub-Admin.');
  const from = ticket.assignedTo;
  ticket.assignedTo = assignee.id;
  event(ticket, req.user.id, 'ASSIGNED', { from, to: assignee.id, text: req.body.reason });
  save(); res.json(outputTicket(req.user, ticket));
});
api.post('/tickets/:code/escalations', (req, res) => {
  const ticket = ticketFor(req);
  if (req.user.role !== 'SUB_ADMIN' || !['OPEN', 'IN_PROGRESS', 'REOPENED'].includes(ticket.status)) fail(403, 'Escalation is not permitted.');
  event(ticket, req.user.id, 'ESCALATION', { text: requireText(req.body.reason, 'reason', 1000), visibility: 'INTERNAL' });
  save(); res.json(outputTicket(req.user, ticket));
});
api.get('/admin/escalations', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  res.json(db.tickets.flatMap(t => t.events.filter(e => e.kind === 'ESCALATION').map(e => ({ ...e, ticketCode: t.id }))));
});
api.get('/admin/audit-logs', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  res.json(db.tickets.flatMap(t => t.events.map(e => ({ ...e, ticketCode: t.id }))).sort((a, b) => b.at.localeCompare(a.at)));
});

api.get('/admin/users', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  res.json(db.users.map(publicUser));
});
api.get('/admin/asset-types', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  res.json(db.assetTypes);
});
api.post('/admin/asset-types', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  const name = requireText(req.body.name, 'name', 60);
  const code = requireText(req.body.code, 'code', 12).toUpperCase();
  if (!/^[A-Z0-9_-]{2,12}$/.test(code) || db.assetTypes.some(a => a.code === code)) fail(400, 'Invalid or duplicate asset code.');
  const defaultPriority = req.body.defaultPriority || 'MEDIUM';
  if (!priorities.includes(defaultPriority)) fail(400, 'Invalid priority.');
  const asset = { id: nextId(), name, code, defaultPriority, active: true };
  db.assetTypes.push(asset); save(); res.status(201).json(asset);
});
api.patch('/admin/asset-types/:id', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  const asset = db.assetTypes.find(a => a.id === req.params.id);
  if (!asset) fail(404, 'Asset type not found.');
  if (req.body.name !== undefined) asset.name = requireText(req.body.name, 'name', 60);
  if (req.body.defaultPriority !== undefined) {
    if (!priorities.includes(req.body.defaultPriority)) fail(400, 'Invalid priority.');
    asset.defaultPriority = req.body.defaultPriority;
  }
  if (req.body.active !== undefined) asset.active = Boolean(req.body.active);
  save(); res.json(asset);
});
api.post('/admin/locations', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  const hierarchy = { CAMPUS: null, BUILDING: 'CAMPUS', FLOOR: 'BUILDING', LAB: 'FLOOR' };
  const parent = db.locations.find(l => l.id === req.body.parentId && l.active !== false);
  if (!(req.body.type in hierarchy) || (hierarchy[req.body.type] && parent?.type !== hierarchy[req.body.type]) || (!hierarchy[req.body.type] && req.body.parentId)) fail(400, 'Invalid location hierarchy.');
  const name = requireText(req.body.name, 'name', 80);
  if (db.locations.some(l => l.parentId === (parent?.id || null) && l.name.toLowerCase() === name.toLowerCase())) fail(409, 'Location already exists under this parent.');
  const location = { id: nextId(), parentId: parent?.id || null, type: req.body.type, name, active: true };
  db.locations.push(location); save(); res.status(201).json(location);
});
api.patch('/admin/locations/:id', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  const location = db.locations.find(l => l.id === req.params.id);
  if (!location) fail(404, 'Location not found.');
  if (req.body.name !== undefined) location.name = requireText(req.body.name, 'name', 80);
  if (req.body.active !== undefined) location.active = Boolean(req.body.active);
  save(); res.json(location);
});
api.post('/admin/users', async (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  const { name, email, employeeId, role, title, allowedLocationIds = [] } = req.body;
  if (!['SUB_ADMIN', 'LAB_ASSISTANT'].includes(role)) fail(400, 'Invalid role.');
  const password = requireText(req.body.password, 'password', 128);
  if (password.length < 10) fail(400, 'Password must be at least 10 characters.');
  if (!Array.isArray(allowedLocationIds) || allowedLocationIds.some(id => !db.locations.some(l => l.id === id))) fail(400, 'Invalid locations.');
  if (db.users.some(u => u.email.toLowerCase() === String(email).toLowerCase() || u.employeeId.toLowerCase() === String(employeeId).toLowerCase())) fail(409, 'Email or employee ID already exists.');
  const user = { id: nextId(), name: requireText(name, 'name', 120), email: requireText(email, 'email', 254).toLowerCase(), employeeId: requireText(employeeId, 'employeeId', 30).toUpperCase(), role,
    title: typeof title === 'string' ? title.slice(0, 80) : '', allowedLocationIds, status: 'ACTIVE', passwordHash: await argon2.hash(password) };
  db.users.push(user); save(); res.status(201).json(publicUser(user));
});
api.patch('/admin/users/:id', async (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) fail(404, 'User not found.');
  if (user.role === 'MAIN_ADMIN' && req.user.id !== user.id) fail(403, 'Cannot edit another Main Admin.');
  if (req.body.name !== undefined) user.name = requireText(req.body.name, 'name', 120);
  if (req.body.title !== undefined) user.title = String(req.body.title).slice(0, 80);
  if (req.body.allowedLocationIds !== undefined) {
    if (!Array.isArray(req.body.allowedLocationIds) || req.body.allowedLocationIds.some(id => !db.locations.some(l => l.id === id))) fail(400, 'Invalid locations.');
    user.allowedLocationIds = req.body.allowedLocationIds;
  }
  if (req.body.password !== undefined) {
    const password = requireText(req.body.password, 'password', 128);
    if (password.length < 10) fail(400, 'Password must be at least 10 characters.');
    user.passwordHash = await argon2.hash(password);
    user.status = 'ACTIVE';
    db.sessions = db.sessions.filter(s => s.userId !== user.id || s === req.session);
  }
  if (req.body.status !== undefined) {
    if (!['ACTIVE', 'DISABLED', 'INVITED'].includes(req.body.status)) fail(400, 'Invalid status.');
    if (user.id === req.user.id && req.body.status !== 'ACTIVE') fail(400, 'You cannot disable your own account.');
    user.status = req.body.status;
  }
  save(); res.json(publicUser(user));
});

api.post('/admin/routing-rules', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  const { locationId, assetTypeId, subAdminId } = req.body;
  if (!db.locations.some(l => l.id === locationId) || !db.assetTypes.some(a => a.id === assetTypeId) ||
      !db.users.some(u => u.id === subAdminId && u.role === 'SUB_ADMIN' && u.status === 'ACTIVE')) fail(400, 'Invalid routing rule.');
  if (db.routingRules.some(r => r.active && r.locationId === locationId && r.assetTypeId === assetTypeId)) fail(409, 'An active rule already exists for this location and asset.');
  const rule = { id: nextId(), locationId, assetTypeId, subAdminId, active: true };
  db.routingRules.push(rule); save(); res.status(201).json(rule);
});
api.get('/admin/routing-rules', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  res.json(db.routingRules);
});
api.patch('/admin/routing-rules/:id', (req, res) => {
  if (req.user.role !== 'MAIN_ADMIN') fail(403, 'Main Admin only.');
  const rule = db.routingRules.find(r => r.id === req.params.id);
  if (!rule) fail(404, 'Routing rule not found.');
  if (req.body.active !== undefined) rule.active = Boolean(req.body.active);
  if (req.body.subAdminId !== undefined) {
    if (!db.users.some(u => u.id === req.body.subAdminId && u.role === 'SUB_ADMIN' && u.status === 'ACTIVE')) fail(400, 'Choose an active Sub-Admin.');
    rule.subAdminId = req.body.subAdminId;
  }
  save(); res.json(rule);
});

api.patch('/tickets/:code/priority', (req, res) => {
  if (!['MAIN_ADMIN', 'SUB_ADMIN'].includes(req.user.role)) fail(403, 'Staff only.');
  const ticket = ticketFor(req);
  if (!priorities.includes(req.body.priority)) fail(400, 'Invalid priority.');
  const from = ticket.priority;
  ticket.priority = req.body.priority;
  ticket.dueAt = new Date(Date.parse(ticket.createdAt) + sla[ticket.priority] * 3600000).toISOString();
  event(ticket, req.user.id, 'STATUS', { from, to: ticket.priority, text: req.body.reason || 'Priority changed', visibility: 'INTERNAL' });
  save(); res.json(outputTicket(req.user, ticket));
});

app.use((err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});

async function start() {
  db = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : { ...structuredClone(reference), tickets: [], sessions: [], sequence: 0 };
  db.sessions ||= [];
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!fs.existsSync(dataFile) && (!adminEmail || !adminPassword || adminPassword.length < 10)) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (10+ characters) before first start.');
  if (adminEmail && adminPassword) {
    let admin = db.users.find(u => u.role === 'MAIN_ADMIN');
    if (!admin) { admin = { id: nextId(), name: process.env.SEED_ADMIN_NAME || 'Main Admin', email: adminEmail, employeeId: process.env.SEED_ADMIN_EMPLOYEE_ID || 'GEU-A-001', role: 'MAIN_ADMIN' }; db.users.push(admin); }
    if (!admin.passwordHash) { admin.email = adminEmail.toLowerCase(); admin.passwordHash = await argon2.hash(adminPassword); admin.status = 'ACTIVE'; }
  }
  for (const user of db.users) user.status ||= user.passwordHash ? 'ACTIVE' : 'INVITED';
  save();
  if (require.main === module) app.listen(Number(process.env.PORT || 4000), () => console.log(`API ready at http://localhost:${process.env.PORT || 4000}${prefix}`));
  return app;
}
module.exports = { app, start };
