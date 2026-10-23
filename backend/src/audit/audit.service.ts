import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { AuditLog } from './audit-log.schema';

export interface AuditEntry {
  actorId: Types.ObjectId | null;
  action: string;
  entityType: string;
  entityId: Types.ObjectId;
  metadata?: Record<string, unknown>;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLog>) {}

  /** Pass the transaction session so the audit row commits or rolls back with the change. */
  async record(entry: AuditEntry, session?: ClientSession) {
    await this.model.create([{ ...entry, metadata: entry.metadata ?? {} }], { session });
  }

  async list(filter: { entityType?: string; entityId?: Types.ObjectId; actorId?: Types.ObjectId }, page = 1, limit = 50) {
    const query: Record<string, unknown> = {};
    if (filter.entityType) query.entityType = filter.entityType;
    if (filter.entityId) query.entityId = filter.entityId;
    if (filter.actorId) query.actorId = filter.actorId;
    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actorId', 'name email role')
        .lean(),
      this.model.countDocuments(query),
    ]);
    return { items, total, page, limit };
  }
}
