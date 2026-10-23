const crypto = require('node:crypto');
const config = require('../config');
const { Session, User } = require('../models');
const { error, plain } = require('../services/common');
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.[config.cookieName];
    if (!token) error(401, 'Sign in required.');
    const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
    if (!session) error(401, 'Sign in required.');
    const user = await User.findOne({ id: session.userId, status: 'ACTIVE' }).lean();
    if (!user) error(401, 'Sign in required.');
    req.user = plain(user);
    req.session = session;
    next();
  } catch (cause) { next(cause); }
}
module.exports = { requireAuth, hashToken };
