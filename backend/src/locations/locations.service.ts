import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LocationType, Role } from '../common/enums';
import type { AuthUser } from '../common/auth-user';
import { Location, LocationDocument } from './location.schema';

/** Which parent type each level must sit under. */
const PARENT_TYPE: Record<LocationType, LocationType | null> = {
  [LocationType.CAMPUS]: null,
  [LocationType.BUILDING]: LocationType.CAMPUS,
  [LocationType.FLOOR]: LocationType.BUILDING,
  [LocationType.LAB]: LocationType.FLOOR,
};

type LeanLocation = Location & { _id: Types.ObjectId };

@Injectable()
export class LocationsService {
  constructor(@InjectModel(Location.name) private readonly model: Model<Location>) {}

  async create(input: { parentId?: Types.ObjectId; type: LocationType; name: string; code?: string }) {
    const expectedParent = PARENT_TYPE[input.type];
    let ancestors: Types.ObjectId[] = [];

    if (expectedParent) {
      if (!input.parentId) throw new BadRequestException(`A ${input.type} must have a ${expectedParent} parent.`);
      const parent = await this.model.findById(input.parentId).lean();
      if (!parent) throw new NotFoundException('Parent location not found.');
      if (parent.type !== expectedParent) throw new BadRequestException(`A ${input.type} must sit under a ${expectedParent}, not a ${parent.type}.`);
      if (!parent.active) throw new BadRequestException('Parent location is inactive.');
      ancestors = [...parent.ancestors, parent._id];
    } else if (input.parentId) {
      throw new BadRequestException('A CAMPUS cannot have a parent.');
    }

    try {
      const [doc] = await this.model.create([{ ...input, parentId: input.parentId ?? null, ancestors }]);
      return doc.toObject();
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ConflictException('A location with this name already exists here.');
      throw e;
    }
  }

  async update(id: Types.ObjectId, changes: { name?: string; code?: string; active?: boolean }) {
    try {
      const doc = await this.model.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true }).lean();
      if (!doc) throw new NotFoundException('Location not found.');
      return doc;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ConflictException('A location with this name already exists here.');
      throw e;
    }
  }

  list(includeInactive = false) {
    return this.model
      .find(includeInactive ? {} : { active: true })
      .sort({ type: 1, name: 1 })
      .lean();
  }

  async get(id: Types.ObjectId): Promise<LeanLocation> {
    const loc = await this.model.findById(id).lean();
    if (!loc) throw new NotFoundException('Location not found.');
    return loc;
  }

  /** The location itself, then its parents up to the campus — most specific first. */
  pathIds(loc: LeanLocation | LocationDocument): Types.ObjectId[] {
    return [loc._id, ...[...loc.ancestors].reverse()];
  }

  /** True when the location and every ancestor are active. */
  async isFullyActive(loc: LeanLocation) {
    if (!loc.active) return false;
    if (!loc.ancestors.length) return true;
    const inactive = await this.model.countDocuments({ _id: { $in: loc.ancestors }, active: false });
    return inactive === 0;
  }

  /** Access is inherited: permission on a building covers its floors and labs. */
  canRaiseAt(user: Pick<AuthUser, 'role' | 'allowedLocationIds'>, loc: LeanLocation) {
    if (user.role === Role.MAIN_ADMIN) return true;
    if (user.role !== Role.LAB_ASSISTANT) return false;
    const allowed = new Set(user.allowedLocationIds.map(String));
    return this.pathIds(loc).some((id) => allowed.has(String(id)));
  }

  /** Active locations the user may raise tickets for (used by the portal wizard and WhatsApp bot). */
  async permittedFor(user: Pick<AuthUser, 'role' | 'allowedLocationIds'>) {
    if (user.role === Role.MAIN_ADMIN) return this.list();
    if (user.role !== Role.LAB_ASSISTANT || !user.allowedLocationIds.length) return [];
    const ids = user.allowedLocationIds;
    // The granted nodes, everything beneath them, and their ancestors (so the tree can be drawn).
    const granted = await this.model.find({ _id: { $in: ids } }).lean();
    const ancestorIds = granted.flatMap((g) => g.ancestors);
    return this.model
      .find({ active: true, $or: [{ _id: { $in: [...ids, ...ancestorIds] } }, { ancestors: { $in: ids } }] })
      .sort({ type: 1, name: 1 })
      .lean();
  }

  /** "GR Block › Floor 2 › Lab 205" for many locations at once. */
  async describe(ids: Types.ObjectId[]): Promise<Map<string, string>> {
    const locs = await this.model.find({ _id: { $in: ids } }).lean();
    const allAncestorIds = [...new Set(locs.flatMap((l) => l.ancestors.map(String)))];
    const ancestors = await this.model.find({ _id: { $in: allAncestorIds } }).lean();
    const names = new Map([...locs, ...ancestors].map((l) => [String(l._id), l]));
    return new Map(
      locs.map((l) => [
        String(l._id),
        [...l.ancestors.map((a) => names.get(String(a))), l]
          .filter((x): x is NonNullable<typeof x> => !!x && x.type !== LocationType.CAMPUS)
          .map((x) => x.name)
          .join(' › '),
      ]),
    );
  }

  /** Validate a list of ids exist (used when granting lab assistants access). */
  async assertExist(ids: Types.ObjectId[]) {
    const count = await this.model.countDocuments({ _id: { $in: ids } });
    if (count !== new Set(ids.map(String)).size) throw new BadRequestException('One or more locations do not exist.');
  }
}
