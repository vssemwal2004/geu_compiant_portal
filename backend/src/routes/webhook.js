const express = require('express');
const crypto = require('node:crypto');
const config = require('../config');
const { processWebhook } = require('../services/whatsapp');
const { error, wrap } = require('../services/common');
const router = express.Router();
function safeEqual(a, b) {
  const left = Buffer.from(String(a || '')); const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
router.get('/', (req, res) => {
  if (!config.whatsapp.verifyToken) error(503, 'WhatsApp is not configured.');
  if (req.query['hub.mode'] !== 'subscribe' || !safeEqual(req.query['hub.verify_token'], config.whatsapp.verifyToken)) error(403, 'Invalid verification token.');
  res.type('text/plain').send(String(req.query['hub.challenge'] || ''));
});
router.post('/', express.raw({ type: 'application/json', limit: '2mb' }), wrap(async (req, res) => {
  if (!config.whatsapp.appSecret || !config.whatsapp.accessToken || !config.whatsapp.phoneNumberId) error(503, 'WhatsApp is not fully configured.');
  const signature = req.get('x-hub-signature-256') || '';
  const expected = `sha256=${crypto.createHmac('sha256', config.whatsapp.appSecret).update(req.body).digest('hex')}`;
  if (!safeEqual(signature, expected)) error(401, 'Invalid webhook signature.');
  let payload;
  try { payload = JSON.parse(req.body.toString('utf8')); } catch { error(400, 'Invalid JSON.'); }
  await processWebhook(payload);
  res.json({ received: true });
}));
module.exports = router;
