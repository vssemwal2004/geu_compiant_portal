import { routingRules, users } from '../data/mockData';
import { ancestry } from './locations';
import type { RoutingRule } from './types';

export interface RouteResult {
  assigneeId: string;
  rule: RoutingRule;
}

/**
 * Routing engine (architecture PDF §9): look for an active rule for this asset type
 * at the exact lab, then floor, building and campus. The most specific match wins.
 * Returns null when nothing matches — the ticket goes to the unassigned queue.
 */
export function resolveRoute(locationId: string, assetTypeId: string): RouteResult | null {
  for (const loc of ancestry(locationId)) {
    const rule = routingRules.find(
      (r) => r.active && r.locationId === loc.id && r.assetTypeId === assetTypeId,
    );
    if (!rule) continue;
    const subAdmin = users.find((u) => u.id === rule.subAdminId && u.role === 'SUB_ADMIN');
    if (subAdmin) return { assigneeId: subAdmin.id, rule };
  }
  return null;
}
