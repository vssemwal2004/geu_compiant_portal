const express = require('express');
const crypto = require('node:crypto');
const argon2 = require('argon2');
const config = require('../config');
const { User, Session } = require('../models');
const { error, text, plain, audit, wrap } = require('../services/common');
const { requireAuth, hashToken } = require('../middleware/auth');
const router = express.Router();
const attempts = new Map();
router.post('/login', wrap(async (req, res) => {
  const identifier = text(req.body.identifier, 'identifier', 254).toLowerCase();
  const password = text(req.body.password, 'password', 128);
  const key = `${req.ip}:${identifier}`;
  const state = attempts.get(key);
  if (state?.until > Date.now() && state.count >= 10) error(429, 'Too many login attempts. Try again later.');
  const user = await User.findOne({ $or: [{ email: identifier }, { employeeId: identifier.toUpperCase() }] }).select('+passwordHash');
  if (!user || user.status !== 'ACTIVE' || !user.passwordHash || !await argon2.verify(user.passwordHash, password)) {
    attempts.set(key, { count: state?.until > Date.now() ? state.count + 1 : 1, until: Date.now() + 60000 });
    error(401, 'Those credentials did not match an active account.');
  }
  attempts.delete(key);
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.sessionHours * 3600000);
  await Session.create({ tokenHash: hashToken(token), userId: user.id, expiresAt });
  user.lastLoginAt = new Date(); await user.save();
  await audit(user.id, 'LOGIN', 'User', user.id);
  res.cookie(config.cookieName, token, { httpOnly: true, secure: config.cookieSecure, sameSite: config.cookieSameSite, path: '/', expires: expiresAt });
  res.json({ user: plain(user) });
}));
router.use(requireAuth);
router.get('/me', (req, res) => res.json({ user: req.user }));
router.post('/logout', wrap(async (req, res) => {
  await Session.deleteOne({ tokenHash: req.session.tokenHash });
  res.clearCookie(config.cookieName, { path: '/' }).status(204).end();
}));
router.post('/change-password', wrap(async (req, res) => {
  const user = await User.findOne({ id: req.user.id }).select('+passwordHash');
  if (!user?.passwordHash || !await argon2.verify(user.passwordHash, req.body.currentPassword || '')) error(400, 'Current password is incorrect.');
  const password = text(req.body.newPassword, 'newPassword', 128);
  if (password.length < 10) error(400, 'Password must be at least 10 characters.');
  user.passwordHash = await argon2.hash(password); await user.save();
  await Session.deleteMany({ userId: user.id, tokenHash: { $ne: req.session.tokenHash } });
  await audit(user.id, 'CHANGE_PASSWORD', 'User', user.id);
  res.status(204).end();
}));
module.exports = router;
