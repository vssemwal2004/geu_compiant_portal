import { locations } from '../data/referenceData';
import type { Location, LocationType, User } from './types';

export function getLocation(id: string): Location | undefined {
  return locations.find(l => l.id === id);
}

/** The location itself followed by its parents up to the campus (most specific first). */
export function ancestry(id: string): Location[] {
  const chain: Location[] = [];
  let cur = getLocation(id);
  while (cur) {
    chain.push(cur);
    cur = cur.parentId ? getLocation(cur.parentId) : undefined;
  }
  return chain;
}

export function ancestorOfType(id: string, type: LocationType): Location | undefined {
  return ancestry(id).find((l) => l.type === type);
}

/** "GR Block › Floor 2 › Lab 205" — campus omitted because there is one campus today. */
export function locationPath(id: string): string {
  return ancestry(id)
    .filter((l) => l.type !== 'CAMPUS')
    .reverse()
    .map((l) => l.name)
    .join(' › ');
}

export function childrenOf(parentId: string | null): Location[] {
  return locations.filter((l) => l.parentId === parentId);
}

/**
 * Access is inherited: permission on a building covers its floors and labs.
 * Main Admin may raise tickets anywhere.
 */
export function canRaiseAt(user: User, locationId: string): boolean {
  if (user.role === 'MAIN_ADMIN') return true;
  if (user.role !== 'LAB_ASSISTANT') return false;
  const allowed = new Set(user.allowedLocationIds ?? []);
  return ancestry(locationId).some((l) => allowed.has(l.id));
}

/** Buildings a user may pick from in the location step. */
export function permittedBuildings(user: User): Location[] {
  return locations.filter(
    (l) => l.type === 'BUILDING' && (user.role === 'MAIN_ADMIN' || canRaiseAt(user, l.id)),
  );
}
