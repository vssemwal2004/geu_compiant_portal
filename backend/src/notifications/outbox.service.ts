import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { OutboxChannel, OutboxMessage } from './outbox.schema';

export interface OutboxItem {
  ticketId?: Types.ObjectId;
  recipientId: Types.ObjectId;
  channel: OutboxChannel;
  type: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class OutboxService {
  constructor(@InjectModel(OutboxMessage.name) private readonly model: Model<OutboxMessage>) {}

  /** Queue notifications inside the caller's transaction. Delivery happens in a worker (Phase 4). */
  async enqueue(items: OutboxItem[], session?: ClientSession) {
    if (!items.length) return;
    await this.model.create(
      items.map((i) => ({ ...i, payload: i.payload ?? {} })),
      { session, ordered: true },
    );
  }

  /** Record a WhatsApp delivery receipt (sent / delivered / read / failed). */
  async recordDeliveryStatus(providerMessageId: string, status: string, error?: string) {
    await this.model.updateOne(
      { providerMessageId },
      { $set: { deliveryStatus: status, ...(error ? { lastError: error } : {}) } },
    );
  }
}
