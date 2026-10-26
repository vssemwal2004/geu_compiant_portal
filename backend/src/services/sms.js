const config = require('../config');
const { error } = require('./common');

async function sendLoginCode(phone, code) {
  const { authKey, templateId, senderId, baseUrl } = config.msg91;
  if (!authKey || !templateId) error(503, 'SMS login is not configured.');
  let response;
  try {
    response = await fetch(baseUrl, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { accept: 'application/json', authkey: authKey, 'content-type': 'application/json' },
      body: JSON.stringify({ template_id: templateId, short_url: '0',
        ...(senderId ? { sender: senderId } : {}),
        recipients: [{ mobiles: phone.replace(/\D/g, ''), OTP: code, Validity: '5' }] }),
    });
  } catch (_) { error(502, 'Could not send the SMS. Please try again.'); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.type === 'error' || result.status === 'error' || result.hasError === true) error(502, 'Could not send the SMS. Please try again.');
}

module.exports = { sendLoginCode };
