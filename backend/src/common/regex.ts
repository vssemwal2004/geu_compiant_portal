/** Escape user text so it can be used safely inside a RegExp (prevents regex injection / ReDoS). */
export const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
