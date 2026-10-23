/**
 * Most-specific-match routing (PDF §9). Pure so it can be unit-tested without a database.
 * `path` is the ticket's location followed by its ancestors (lab → floor → building → campus).
 * Rules are already filtered to the ticket's asset type and active status.
 */
export function pickRule<R extends { locationId: { toString(): string } }>(path: { toString(): string }[], rules: R[]): R | null {
  for (const loc of path) {
    const hit = rules.find((r) => r.locationId.toString() === loc.toString());
    if (hit) return hit;
  }
  return null;
}
