const { Ticket, Location, AssetType, Attachment, Counter } = require('../models');
const config = require('../config');
const { id, error, text, plain, ancestry, routeFor, audit } = require('./common');
const imageStorage = require('./imageStorage');
const SLA_HOURS = { CRITICAL: 4, HIGH: 24, MEDIUM: 48, LOW: 96 };
const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CLOSED', 'CANCELLED'];
const activeStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REOPENED'];
const sizeLimit = 5 * 1024 * 1024;
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

function visible(user, ticket) {
  return ['MAIN_ADMIN', 'ADMIN'].includes(user.role) || (user.role === 'SUB_ADMIN' && ticket.assignedTo === user.id) || (user.role === 'LAB_ASSISTANT' && ticket.creatorId === user.id);
}
function output(user, ticket) {
  const value = plain(ticket);
  value.createdAt = new Date(value.createdAt).toISOString();
  value.dueAt = new Date(value.dueAt).toISOString();
  value.imageUrl = value.imageAttachmentId ? `${config.prefix}/uploads/${value.imageAttachmentId}` : undefined;
  value.evidenceUrls = (value.evidenceAttachmentIds || []).map(id => `${config.prefix}/uploads/${id}`);
  value.events = (value.events || []).filter(e => user.role !== 'LAB_ASSISTANT' || e.visibility === 'PUBLIC');
  delete value.idempotencyKey;
  return value;
}
function addEvent(ticket, actorId, kind, fields = {}) {
  ticket.events.push({ id: id(), at: new Date().toISOString(), actorId, kind, visibility: 'PUBLIC', ...fields });
}
async function getVisible(user, code) {
  const ticket = await Ticket.findOne({ id: code });
  if (!ticket || !visible(user, ticket)) error(404, 'Ticket not found.');
  return ticket;
}
async function scopedList(user, query = {}) {
  const scope = ['MAIN_ADMIN', 'ADMIN'].includes(user.role) ? {} : user.role === 'SUB_ADMIN' ? { assignedTo: user.id } : { creatorId: user.id };
  const filter = { ...scope };
  if (query.status && statuses.includes(query.status)) filter.status = query.status;
  if (query.unassigned === 'true' && ['MAIN_ADMIN', 'ADMIN'].includes(user.role)) filter.assignedTo = null;
  const tickets = await Ticket.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  return tickets.map(t => output(user, t));
}
async function storeImage(ownerId, kind, mimeType, buffer) {
  if (!imageTypes.includes(mimeType) || !Buffer.isBuffer(buffer) || !buffer.length || buffer.length > sizeLimit) error(400, 'Use a JPG, PNG or WebP image up to 5 MB.');
  const attachmentId = id();
  const storageKey = config.s3.bucket ? `attachments/${attachmentId}` : undefined;
  if (storageKey) await imageStorage.putImage(storageKey, mimeType, buffer);
  let attachment;
  try {
    attachment = await Attachment.create({ id: attachmentId, ownerId, kind, mimeType,
      ...(storageKey ? { storageKey } : { data: buffer }), sizeBytes: buffer.length,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600000) });
  } catch (cause) {
    if (storageKey) await imageStorage.deleteImage(storageKey);
    throw cause;
  }
  return attachment.id;
}
async function create(user, input, opts = {}) {
  if (!['MAIN_ADMIN', 'LAB_ASSISTANT'].includes(user.role)) error(403, 'This role cannot create tickets.');
  const description = text(input.description, 'description', 1000);
  if (description.length < 10) error(400, 'Description must be at least 10 characters.');
  const location = await Location.findOne({ id: input.locationId, type: 'LAB', active: true }).lean();
  const asset = await AssetType.findOne({ id: input.assetTypeId, active: true }).lean();
  if (!location || !asset) error(400, 'Choose an active room and asset type.');
  if (user.role === 'LAB_ASSISTANT' && !(await ancestry(location.id)).some(x => user.allowedLocationIds?.includes(x))) error(403, 'You cannot raise tickets for this location.');
  if (opts.idempotencyKey) {
    const existing = await Ticket.findOne({ creatorId: user.id, idempotencyKey: opts.idempotencyKey });
    if (existing) return output(user, existing);
  }
  let imageAttachmentId = input.imageAttachmentId;
  if (imageAttachmentId) {
    if (!await Attachment.exists({ id: imageAttachmentId, ownerId: user.id, kind: 'ISSUE', ticketId: { $exists: false } })) error(400, 'Invalid issue image.');
  } else if (typeof input.imageUrl === 'string') {
    const match = input.imageUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) error(400, 'Invalid image.');
    imageAttachmentId = await storeImage(user.id, 'ISSUE', match[1], Buffer.from(match[2], 'base64'));
  } else error(400, 'An issue image is required.');
  const rule = await routeFor(location.id, asset.id);
  const now = new Date();
  const counter = await Counter.findOneAndUpdate({ name: `ticket-${now.getFullYear()}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
  const code = `GEU-${now.getFullYear()}-${String(counter.value).padStart(6, '0')}`;
  const ticket = new Ticket({ id: code, creatorId: user.id, locationId: location.id, assetTypeId: asset.id,
    assignedTo: rule?.subAdminId || null, routingRuleId: rule?.id || null, status: 'OPEN', priority: asset.defaultPriority,
    source: opts.source || 'PORTAL', description, imageAttachmentId,
    dueAt: new Date(now.getTime() + SLA_HOURS[asset.defaultPriority] * 3600000), idempotencyKey: opts.idempotencyKey });
  addEvent(ticket, user.id, 'CREATED', { text: 'Ticket created' });
  if (rule) addEvent(ticket, null, 'ASSIGNED', { to: rule.subAdminId });
  try { await ticket.save(); }
  catch (cause) {
    if (cause.code === 11000 && opts.idempotencyKey) {
      const existing = await Ticket.findOne({ creatorId: user.id, idempotencyKey: opts.idempotencyKey });
      if (existing) return output(user, existing);
    }
    throw cause;
  }
  await Attachment.updateOne({ id: imageAttachmentId }, { $set: { ticketId: code }, $unset: { expiresAt: 1 } });
  await audit(user.id, 'CREATE_TICKET', 'Ticket', code, { source: ticket.source });
  return output(user, ticket);
}
async function changeStatus(user, code, to, note) {
  const ticket = await getVisible(user, code);
  const from = ticket.status;
  const cleanNote = typeof note === 'string' ? note.trim() : '';
  const worker = (user.role === 'SUB_ADMIN' && ticket.assignedTo === user.id) || (user.role === 'MAIN_ADMIN' && ticket.assignedTo);
  const creator = user.role === 'LAB_ASSISTANT' && ticket.creatorId === user.id;
  const resolvedAt = ticket.resolvedAt && new Date(ticket.resolvedAt).getTime();
  const permitted = (worker && ((['OPEN', 'REOPENED'].includes(from) && to === 'IN_PROGRESS') || (from === 'IN_PROGRESS' && to === 'RESOLVED' && !!cleanNote && ticket.evidenceAttachmentIds.length > 0))) ||
    (creator && from === 'RESOLVED' && (to === 'CLOSED' || (to === 'REOPENED' && !!cleanNote && Date.now() - resolvedAt < 72 * 3600000))) ||
    (user.role === 'MAIN_ADMIN' && ((from === 'CLOSED' && to === 'REOPENED' && !!cleanNote) || (activeStatuses.includes(from) && to === 'CANCELLED' && !!cleanNote)));
  if (!permitted) error(403, to === 'RESOLVED' && !ticket.evidenceAttachmentIds.length ? 'Upload resolution evidence before marking resolved.' : 'This status change is not permitted.');
  ticket.status = to;
  if (to === 'RESOLVED') ticket.resolvedAt = new Date();
  if (to === 'CLOSED') ticket.closedAt = new Date();
  addEvent(ticket, user.id, 'STATUS', { from, to, text: cleanNote || undefined });
  await ticket.save(); await audit(user.id, 'CHANGE_STATUS', 'Ticket', code, { from, to });
  return output(user, ticket);
}
async function addMessage(user, code, body, visibility = 'PUBLIC') {
  if (user.role === 'ADMIN') error(403, 'Read-only admins cannot change tickets.');
  const ticket = await getVisible(user, code);
  if (!activeStatuses.includes(ticket.status)) error(400, 'This ticket is closed.');
  if (visibility === 'INTERNAL' && user.role === 'LAB_ASSISTANT') error(403, 'Internal notes are staff only.');
  if (!['PUBLIC', 'INTERNAL'].includes(visibility)) error(400, 'Invalid visibility.');
  addEvent(ticket, user.id, 'MESSAGE', { text: text(body, 'body', 2000), visibility });
  await ticket.save(); await audit(user.id, 'ADD_MESSAGE', 'Ticket', code, { visibility });
  return output(user, ticket);
}
async function assign(user, code, assigneeId, reason) {
  if (user.role !== 'MAIN_ADMIN') error(403, 'Super Admin only.');
  const ticket = await getVisible(user, code);
  if (['CLOSED', 'CANCELLED'].includes(ticket.status)) error(400, 'This ticket is closed.');
  const { User } = require('../models');
  const assignee = await User.findOne({ id: assigneeId, role: 'SUB_ADMIN', status: 'ACTIVE' }).lean();
  if (!assignee) error(400, 'Choose an active Sub-Admin.');
  if (assignee.scopeLocationIds?.length && !(await ancestry(ticket.locationId)).some(x => assignee.scopeLocationIds.includes(x))) error(400, 'Sub-Admin is outside this location scope.');
  const from = ticket.assignedTo;
  ticket.assignedTo = assigneeId;
  addEvent(ticket, user.id, 'ASSIGNED', { from, to: assigneeId, text: reason || undefined });
  await ticket.save(); await audit(user.id, 'ASSIGN_TICKET', 'Ticket', code, { from, to: assigneeId });
  return output(user, ticket);
}
async function escalate(user, code, reason) {
  const ticket = await getVisible(user, code);
  if (user.role !== 'SUB_ADMIN' || !user.permissions?.includes('ESCALATE_ASSIGNED') || !['OPEN', 'IN_PROGRESS', 'REOPENED'].includes(ticket.status)) error(403, 'Escalation is not permitted.');
  addEvent(ticket, user.id, 'ESCALATION', { text: text(reason, 'reason', 1000), visibility: 'INTERNAL' });
  await ticket.save(); await audit(user.id, 'ESCALATE_TICKET', 'Ticket', code);
  return output(user, ticket);
}
async function evidence(user, code, mimeType, buffer) {
  const ticket = await getVisible(user, code);
  if (!['MAIN_ADMIN', 'SUB_ADMIN'].includes(user.role) || !['OPEN', 'IN_PROGRESS', 'REOPENED'].includes(ticket.status)) error(403, 'Evidence upload is not permitted.');
  const attachmentId = await storeImage(user.id, 'EVIDENCE', mimeType, buffer);
  await Attachment.updateOne({ id: attachmentId }, { $set: { ticketId: code }, $unset: { expiresAt: 1 } });
  ticket.evidenceAttachmentIds.push(attachmentId);
  addEvent(ticket, user.id, 'EVIDENCE', { text: 'Resolution evidence uploaded', attachmentId });
  await ticket.save(); await audit(user.id, 'ADD_EVIDENCE', 'Ticket', code);
  return output(user, ticket);
}
module.exports = { visible, output, getVisible, scopedList, storeImage, create, changeStatus, addMessage, assign, escalate, evidence, SLA_HOURS };
