/**
 * Normalise an Indian or international phone number to E.164 (e.g. "+919000000001").
 * WhatsApp sends sender numbers without "+", so both sides are normalised the same way
 * before lookup. Returns null if the input cannot be a valid number.
 */
export function toE164(input: string, defaultCountryCode = '91'): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (trimmed.startsWith('+')) {
    // already international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.length === 10) {
    digits = defaultCountryCode + digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = defaultCountryCode + digits.slice(1);
  }

  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : null;
}
