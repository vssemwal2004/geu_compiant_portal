import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TicketPriority } from '../common/enums';
import { AssetType } from './asset-type.schema';

@Injectable()
export class AssetTypesService {
  constructor(@InjectModel(AssetType.name) private readonly model: Model<AssetType>) {}

  list(includeInactive = false) {
    return this.model.find(includeInactive ? {} : { active: true }).sort({ name: 1 }).lean();
  }

  async get(id: Types.ObjectId) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Asset type not found.');
    return doc;
  }

  async create(input: { name: string; code: string; defaultPriority?: TicketPriority }) {
    try {
      const [doc] = await this.model.create([input]);
      return doc.toObject();
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw new ConflictException('An asset type with this code already exists.');
      throw e;
    }
  }

  async update(id: Types.ObjectId, changes: { name?: string; defaultPriority?: TicketPriority; active?: boolean }) {
    const doc = await this.model.findByIdAndUpdate(id, { $set: changes }, { new: true, runValidators: true }).lean();
    if (!doc) throw new NotFoundException('Asset type not found.');
    return doc;
  }
}
