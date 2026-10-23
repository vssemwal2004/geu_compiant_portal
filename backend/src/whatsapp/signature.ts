import { createHmac } from 'node:crypto';
import { safeEqual } from '../common/tokens';

/**
 * Meta signs each webhook with HMAC-SHA256 of the raw request body using the app secret,
 * sent as `X-Hub-Signature-256: sha256=<hex>`. The raw bytes must be used — re-serialised JSON
 * would not match.
 */
export function isValidMetaSignature(rawBody: Buffer, header: string | undefined, appSecret: string) {
  if (!header?.startsWith('sha256=') || !appSecret) return false;
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return safeEqual(expected, header);
}
