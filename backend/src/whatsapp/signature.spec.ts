import { createHmac } from 'node:crypto';
import { isValidMetaSignature } from './signature';

const secret = 'test-app-secret';
const body = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');
const sign = (b: Buffer, s = secret) => 'sha256=' + createHmac('sha256', s).update(b).digest('hex');

describe('Meta webhook signature', () => {
  it('accepts a correct signature', () => {
    expect(isValidMetaSignature(body, sign(body), secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    expect(isValidMetaSignature(Buffer.from(body.toString() + ' '), sign(body), secret)).toBe(false);
  });

  it('rejects the wrong secret, a missing header and a missing secret', () => {
    expect(isValidMetaSignature(body, sign(body, 'other'), secret)).toBe(false);
    expect(isValidMetaSignature(body, undefined, secret)).toBe(false);
    expect(isValidMetaSignature(body, sign(body), '')).toBe(false);
  });
});
