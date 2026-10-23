import type { AssetType, Location, RoutingRule, User } from '../domain/types';

// Filled from GET /api/v1/reference after the server confirms the session.
export const users: User[] = [];
export const locations: Location[] = [];
export const assetTypes: AssetType[] = [];
export const routingRules: RoutingRule[] = [];
