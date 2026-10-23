import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Role, UserStatus } from '../common/enums';
import { AssetTypesService } from '../asset-types/asset-types.service';
import { LocationsService } from '../locations/locations.service';
import { User } from '../users/user.schema';
import { pickRule } from './routing.logic';
import { RoutingRule } from './routing-rule.schema';

const DUPLICATE_RULE = 'An active rule already exists for this location and asset type. Deactivate or edit it instead.';

@Injectable()
export class RoutingService {
  constructor(
    @InjectModel(RoutingRule.name) private readonly rules: Model<RoutingRule>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly locations: LocationsService,
    private readonly assetTypes: AssetTypesService,
  ) {}

  /**
   * Find the Sub-Admin for a location + asset type: exact lab first, then floor, building, campus.
   * A rule whose Sub-Admin is no longer active is skipped. Null → the unassigned queue.
   */
  async resolve(pathIds: Types.ObjectId[], assetTypeId: Types.ObjectId, session?: ClientSession) {
    const candidates = await this.rules
      .find({ active: true, assetTypeId, locationId: { $in: pathIds } })
      .session(session ?? null)
      .lean();
    if (!candidates.length) return null;

    const activeSubAdmins = new Set(
      (
        await this.users
          .find({ _id: { $in: candidates.map((c) => c.subAdminId) }, role: Role.SUB_ADMIN, status: UserStatus.ACTIVE })
          .session(session ?? null)
          .select('_id')
          .lean()
      ).map((u) => String(u._id)),
    );
    const usable = candidates.filter((c) => activeSubAdmins.has(String(c.subAdminId)));
    return pickRule(pathIds, usable);
  }

  list(filter: { subAdminId?: Types.ObjectId; includeInactive?: boolean } = {}) {
    return this.rules
      .find({
        ...(filter.includeInactive ? {} : { active: true }),
        ...(filter.subAdminId ? { subAdminId: filter.subAdminId } : {}),
      })
      .populate('locationId', 'name type')
      .populate('assetTypeId', 'name code')
      .populate('subAdminId', 'name email status')
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(input: { locationId: Types.ObjectId; assetTypeId: Types.ObjectId; subAdminId: Types.ObjectId }, actorId: Types.ObjectId) {
    await this.locations.get(input.locationId);
    await this.assetTypes.get(input.assetTypeId);
    await this.assertSubAdmin(input.subAdminId);
    try {
      const [doc] = await this.rules.create([{ ...input, active: true, createdBy: actorId }]);
      return doc.toObject();
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ConflictException(DUPLICATE_RULE);
      throw e;
    }
  }

  async update(id: Types.ObjectId, changes: { subAdminId?: Types.ObjectId; active?: boolean }) {
    if (changes.subAdminId) await this.assertSubAdmin(changes.subAdminId);
    try {
      const doc = await this.rules.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean();
      if (!doc) throw new NotFoundException('Routing rule not found.');
      return doc;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ConflictException(DUPLICATE_RULE);
      throw e;
    }
  }

  private async assertSubAdmin(id: Types.ObjectId) {
    const user = await this.users.findById(id).lean();
    if (!user || user.role !== Role.SUB_ADMIN) throw new BadRequestException('Rules must point to a Sub-Admin account.');
    if (user.status === UserStatus.DISABLED) throw new BadRequestException('That Sub-Admin account is disabled.');
  }
}
