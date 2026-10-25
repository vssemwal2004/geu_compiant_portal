const mongoose = require('mongoose');
const { Schema } = mongoose;
const options = name => ({ collection: name, timestamps: true, versionKey: false });

const userSchema = new Schema({
  id: { type: String, unique: true, required: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  role: { type: String, enum: ['MAIN_ADMIN', 'ADMIN', 'SUB_ADMIN', 'LAB_ASSISTANT'], required: true },
  title: String,
  phone: String,
  phoneE164: { type: String, unique: true, sparse: true },
  defaultLocationId: String,
  allowedLocationIds: { type: [String], default: [] },
  scopeLocationIds: { type: [String], default: [] },
  permissions: { type: [String], default: [] },
  status: { type: String, enum: ['ACTIVE', 'INVITED', 'DISABLED'], default: 'INVITED' },
  passwordHash: { type: String, select: false },
  mustChangePassword: { type: Boolean, default: false },
  lastLoginAt: Date,
}, options('users'));
userSchema.index({ role: 1, status: 1 });

const sessionSchema = new Schema({
  tokenHash: { type: String, unique: true, required: true },
  userId: { type: String, required: true, index: true },
  method: { type: String, enum: ['PASSWORD', 'SMS'], default: 'PASSWORD' },
  expiresAt: { type: Date, required: true },
}, options('sessions'));
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const otpSchema = new Schema({
  phone: { type: String, unique: true, required: true },
  codeHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  resendAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  sends: { type: Number, default: 1 },
  windowEndsAt: { type: Date, required: true },
}, options('login_otps'));
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

const authLimitSchema = new Schema({
  key: { type: String, unique: true, required: true },
  count: { type: Number, default: 0 },
  resetsAt: { type: Date, required: true },
}, options('auth_limits'));
authLimitSchema.index({ resetsAt: 1 }, { expireAfterSeconds: 3600 });

const locationSchema = new Schema({
  id: { type: String, unique: true, required: true }, parentId: { type: String, default: null },
  type: { type: String, enum: ['CAMPUS', 'BUILDING', 'FLOOR', 'LAB'], required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  code: String, active: { type: Boolean, default: true },
}, options('locations'));
locationSchema.index({ parentId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const assetSchema = new Schema({
  id: { type: String, unique: true, required: true }, name: { type: String, required: true },
  code: { type: String, unique: true, required: true },
  defaultPriority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  active: { type: Boolean, default: true },
}, options('asset_types'));

const routingSchema = new Schema({
  id: { type: String, unique: true, required: true }, locationId: { type: String, required: true },
  assetTypeId: { type: String, required: true }, subAdminId: { type: String, required: true },
  active: { type: Boolean, default: true }, createdBy: String,
}, options('routing_rules'));
routingSchema.index({ locationId: 1, assetTypeId: 1 }, { unique: true, partialFilterExpression: { active: true } });

const eventSchema = new Schema({
  id: String, at: String, actorId: { type: String, default: null },
  kind: { type: String, enum: ['CREATED', 'STATUS', 'ASSIGNED', 'MESSAGE', 'ESCALATION', 'EVIDENCE', 'PRIORITY'] },
  from: String, to: String, text: String, visibility: { type: String, default: 'PUBLIC' }, attachmentId: String,
}, { _id: false });
const ticketSchema = new Schema({
  id: { type: String, unique: true, required: true }, creatorId: { type: String, required: true, index: true },
  locationId: { type: String, required: true }, assetTypeId: { type: String, required: true },
  assignedTo: { type: String, default: null, index: true }, routingRuleId: { type: String, default: null },
  status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REOPENED', 'CLOSED', 'CANCELLED'], default: 'OPEN' },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
  source: { type: String, enum: ['PORTAL', 'WHATSAPP'], required: true },
  description: { type: String, required: true, maxlength: 1000 },
  imageAttachmentId: String, evidenceAttachmentIds: { type: [String], default: [] },
  dueAt: { type: Date, required: true }, resolvedAt: Date, closedAt: Date,
  events: { type: [eventSchema], default: [] }, idempotencyKey: String,
}, options('tickets'));
ticketSchema.index({ creatorId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

const attachmentSchema = new Schema({
  id: { type: String, unique: true, required: true },
  mimeType: { type: String, required: true }, data: { type: Buffer, required: true },
  sizeBytes: Number, ownerId: String, ticketId: String, expiresAt: Date,
  kind: { type: String, enum: ['ISSUE', 'EVIDENCE'], required: true },
}, options('attachments'));
attachmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const counterSchema = new Schema({ name: { type: String, unique: true }, value: { type: Number, default: 0 } }, { collection: 'counters', versionKey: false });
const auditSchema = new Schema({
  at: { type: Date, default: Date.now }, actorId: String, action: String, targetType: String,
  targetId: String, details: Schema.Types.Mixed,
}, { collection: 'audit_logs', versionKey: false });
auditSchema.index({ at: -1 });

module.exports = {
  User: mongoose.model('User', userSchema), Session: mongoose.model('Session', sessionSchema),
  LoginOtp: mongoose.model('LoginOtp', otpSchema), AuthLimit: mongoose.model('AuthLimit', authLimitSchema),
  Location: mongoose.model('Location', locationSchema), AssetType: mongoose.model('AssetType', assetSchema),
  RoutingRule: mongoose.model('RoutingRule', routingSchema), Ticket: mongoose.model('Ticket', ticketSchema),
  Attachment: mongoose.model('Attachment', attachmentSchema), Counter: mongoose.model('Counter', counterSchema),
  AuditLog: mongoose.model('AuditLog', auditSchema),
};
