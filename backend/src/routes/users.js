const express = require('express');
const argon2 = require('argon2');
const { User, Session, Location, LoginOtp } = require('../models');
const { id, error, text, plain, phoneE164, ancestry, audit, wrap, mainAdmin } = require('../services/common');
const router = express.Router();
router.use(mainAdmin);
const validRoles = ['SUB_ADMIN', 'LAB_ASSISTANT'];
const validStatuses = ['ACTIVE', 'INVITED', 'DISABLED'];
async function checkLocations(ids) {
  if (!Array.isArray(ids) || ids.length > 50) error(400, 'Invalid location scope.');
  if (await Location.countDocuments({ id: { $in: ids }, active: true }) !== new Set(ids).size) error(400, 'Location scope contains an unknown or inactive location.');
}
router.get('/', wrap(async (req, res) => {
  const query = {};
  if (req.query.role) query.role = req.query.role;
  if (req.query.status) query.status = req.query.status;
  const users = await User.find(query).sort({ name: 1 }).lean();
  res.json(users.map(plain));
}));
router.get('/:id', wrap(async (req, res) => {
  const user = await User.findOne({ id: req.params.id }).lean();
  if (!user) error(404, 'User not found.');
  res.json(plain(user));
}));
router.post('/', wrap(async (req, res) => {
  const { role } = req.body;
  if (!validRoles.includes(role)) error(400, 'Invalid role.');
  const name = text(req.body.name, 'name', 120);
  const email = req.body.email ? text(req.body.email, 'email', 254).toLowerCase() : undefined;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error(400, 'Invalid email.');
  const employeeId = text(req.body.employeeId, 'employeeId', 30).toUpperCase();
  if (!/^[A-Z0-9/_-]{2,30}$/.test(employeeId)) error(400, 'Invalid employee ID.');
  const allowedLocationIds = role === 'LAB_ASSISTANT' ? req.body.allowedLocationIds || [] : [];
  const scopeLocationIds = role === 'SUB_ADMIN' ? req.body.scopeLocationIds || [] : [];
  await checkLocations(allowedLocationIds); await checkLocations(scopeLocationIds);
  if (role === 'LAB_ASSISTANT' && !allowedLocationIds.length) error(400, 'Choose at least one allowed location.');
  if (req.body.defaultLocationId && !(await ancestry(req.body.defaultLocationId)).some(x => allowedLocationIds.includes(x))) error(400, 'Default location must be allowed.');
  const phone = phoneE164(req.body.phone);
  if (!email && !phone) error(400, 'Add an email address or mobile number.');
  if (req.body.password && !email) error(400, 'Add an email address for password sign-in.');
  let passwordHash;
  if (req.body.password) {
    const password = text(req.body.password, 'password', 128);
    if (password.length < 10) error(400, 'Password must be at least 10 characters.');
    passwordHash = await argon2.hash(password);
  }
  const user = await User.create({ id: id(), name, email, employeeId, role, title: req.body.title || '', phone, phoneE164: phone,
    allowedLocationIds, scopeLocationIds, defaultLocationId: req.body.defaultLocationId || undefined,
    permissions: role === 'SUB_ADMIN' ? ['RESOLVE_ASSIGNED', ...(req.body.canEscalate === false ? [] : ['ESCALATE_ASSIGNED'])] : ['CREATE_OWN', 'VIEW_OWN'],
    passwordHash, mustChangePassword: !!passwordHash, status: passwordHash || phone ? 'ACTIVE' : 'INVITED' });
  await audit(req.user.id, 'CREATE_USER', 'User', user.id, { role });
  res.status(201).json(plain(user));
}));
router.patch('/:id', wrap(async (req, res) => {
  const user = await User.findOne({ id: req.params.id }).select('+passwordHash');
  if (!user) error(404, 'User not found.');
  const previousEmail = user.email;
  const previousPhone = user.phoneE164;
  if (user.role === 'MAIN_ADMIN' && user.id !== req.user.id) error(403, 'Cannot edit another Main Admin.');
  if (req.body.name !== undefined) user.name = text(req.body.name, 'name', 120);
  if (req.body.title !== undefined) user.title = String(req.body.title).slice(0, 80);
  if (req.body.email !== undefined) {
    const email = req.body.email ? text(req.body.email, 'email', 254).toLowerCase() : undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error(400, 'Invalid email.');
    user.email = email;
  }
  if (req.body.phone !== undefined) {
    user.phone = phoneE164(req.body.phone); user.phoneE164 = user.phone;
  }
  if (req.body.allowedLocationIds !== undefined) { await checkLocations(req.body.allowedLocationIds); user.allowedLocationIds = req.body.allowedLocationIds; }
  if (req.body.scopeLocationIds !== undefined) { await checkLocations(req.body.scopeLocationIds); user.scopeLocationIds = req.body.scopeLocationIds; }
  if (req.body.defaultLocationId !== undefined) {
    const allowed = req.body.allowedLocationIds || user.allowedLocationIds;
    if (req.body.defaultLocationId && !(await ancestry(req.body.defaultLocationId)).some(x => allowed.includes(x))) error(400, 'Default location must be allowed.');
    user.defaultLocationId = req.body.defaultLocationId || undefined;
  }
  if (req.body.canEscalate !== undefined && user.role === 'SUB_ADMIN') user.permissions = ['RESOLVE_ASSIGNED', ...(req.body.canEscalate ? ['ESCALATE_ASSIGNED'] : [])];
  if (req.body.password !== undefined) {
    if (!user.email) error(400, 'Add an email address before setting a password.');
    const password = text(req.body.password, 'password', 128);
    if (password.length < 10) error(400, 'Password must be at least 10 characters.');
    user.passwordHash = await argon2.hash(password); user.mustChangePassword = true; user.status = 'ACTIVE';
    await Session.deleteMany({ userId: user.id, tokenHash: { $ne: req.session.tokenHash } });
  }
  if (req.body.status !== undefined) {
    if (!validStatuses.includes(req.body.status)) error(400, 'Invalid status.');
    if (user.id === req.user.id && req.body.status !== 'ACTIVE') error(400, 'You cannot deactivate your own account.');
    if (req.body.status === 'ACTIVE' && !user.passwordHash && !user.phoneE164) error(400, 'Set a password or mobile number before activating portal access.');
    user.status = req.body.status;
    if (user.status === 'DISABLED') await Session.deleteMany({ userId: user.id });
  }
  if (!user.email && !user.phoneE164) error(400, 'Add an email address or mobile number.');
  if (user.passwordHash && !user.email) error(400, 'An email address is required for password sign-in.');
  if (user.status === 'INVITED' && user.phoneE164 && req.body.status === undefined) user.status = 'ACTIVE';
  await user.save();
  if (previousPhone && previousPhone !== user.phoneE164) await LoginOtp.deleteOne({ phone: previousPhone });
  if (previousEmail !== user.email || previousPhone !== user.phoneE164) await Session.deleteMany({ userId: user.id });
  await audit(req.user.id, 'UPDATE_USER', 'User', user.id, { fields: Object.keys(req.body).filter(k => k !== 'password') });
  res.json(plain(user));
}));
module.exports = router;
