const crypto = require('node:crypto');
const { AuditLog, Location, RoutingRule, User } = require('../models');
const id = () => crypto.randomUUID();
function error(status, message) { const e = new Error(message); e.status = status; throw e; }
function text(value, name, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) error(400, `${name} is required (max ${max} characters).`);
  return value.trim();
}
function plain(doc) {
  if (!doc) return null;
  const value = doc.toObject ? doc.toObject() : { ...doc };
  delete value._id; delete value.__v; delete value.passwordHash; delete value.data;
  return value;
}
function phoneE164(value) {
  if (value == null || value === '') return undefined;
  const digits = String(value).replace(/\D/g, '');
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  if (normalized.length < 10 || normalized.length > 15) error(400, 'Use a valid international mobile number.');
  return `+${normalized}`;
}
async function ancestry(locationId) {
  const path = [];
  let current = await Location.findOne({ id: locationId }).lean();
  while (current && !path.includes(current.id)) {
    path.push(current.id);
    current = current.parentId ? await Location.findOne({ id: current.parentId }).lean() : null;
  }
  return path;
}
async function routeFor(locationId, assetTypeId) {
  for (const id of await ancestry(locationId)) {
    const rule = await RoutingRule.findOne({ locationId: id, assetTypeId, active: true }).lean();
    if (rule && await User.exists({ id: rule.subAdminId, role: 'SUB_ADMIN', status: 'ACTIVE' })) return rule;
  }
  return null;
}
async function audit(actorId, action, targetType, targetId, details = {}) {
  await AuditLog.create({ actorId, action, targetType, targetId, details });
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const mainAdmin = (req, _res, next) => req.user.role === 'MAIN_ADMIN' ? next() : next(Object.assign(new Error('Super Admin only.'), { status: 403 }));
module.exports = { id, error, text, plain, phoneE164, ancestry, routeFor, audit, wrap, mainAdmin };
