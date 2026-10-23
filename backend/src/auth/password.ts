import * as argon2 from 'argon2';

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations).
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string) => argon2.hash(plain, OPTIONS);

export async function verifyPassword(hash: string, plain: string) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** Returns a reason the password is not acceptable, or null if it is fine. */
export function passwordProblem(plain: string, minLength: number): string | null {
  if (plain.length < minLength) return `Password must be at least ${minLength} characters.`;
  if (plain.length > 128) return 'Password must be at most 128 characters.';
  if (!/[A-Za-z]/.test(plain) || !/\d/.test(plain)) return 'Password must contain letters and numbers.';
  return null;
}
