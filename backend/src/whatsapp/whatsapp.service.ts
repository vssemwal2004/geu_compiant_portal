import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, UserStatus } from '../common/enums';
import { toE164 } from '../common/phone';
import { OutboxService } from '../notifications/outbox.service';
import { User } from '../users/user.schema';
import { WaEventStatus, WhatsappEvent } from './whatsapp.schemas';

/** Minimal shape of the parts of Meta's webhook payload we read. */
interface WebhookPayload {
  entry?: {
    changes?: {
      value?: {
        messages?: { id: string; from: string; type: string; [k: string]: unknown }[];
        statuses?: { id: string; status: string; errors?: { title?: string }[] }[];
      };
    }[];
  }[];
}

@Injectable()
export class WhatsappService {
  private readonly log = new Logger(WhatsappService.name);

  constructor(
    @InjectModel(WhatsappEvent.name) private readonly events: Model<WhatsappEvent>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Store inbound messages (deduplicated by message id) and delivery receipts.
   * Only active lab assistants with a verified number are recognised; everything else is
   * recorded as IGNORED_UNREGISTERED and never gets a menu, ticket or data (PDF §5.04).
   * The conversation state machine that turns messages into tickets is Phase 3.
   */
  async handleWebhook(payload: WebhookPayload) {
    const changes = (payload.entry ?? []).flatMap((e) => e.changes ?? []).map((c) => c.value ?? {});
    let stored = 0;
    let duplicates = 0;

    for (const value of changes) {
      for (const msg of value.messages ?? []) {
        const fromE164 = toE164(`+${msg.from}`);
        const user = fromE164
          ? await this.users
              .findOne({ phoneE164: fromE164, role: Role.LAB_ASSISTANT, status: UserStatus.ACTIVE, phoneVerifiedAt: { $exists: true } })
              .select('_id')
              .lean()
          : null;
        try {
          await this.events.create({
            providerMessageId: msg.id,
            direction: 'IN',
            fromE164: fromE164 ?? undefined,
            userId: user?._id,
            messageType: msg.type,
            payload: msg,
            processingStatus: user ? WaEventStatus.RECEIVED : WaEventStatus.IGNORED_UNREGISTERED,
          });
          stored++;
        } catch (e) {
          if ((e as { code?: number }).code === 11000) duplicates++; // Meta retry — already handled
          else throw e;
        }
      }

      for (const st of value.statuses ?? []) {
        await this.outbox.recordDeliveryStatus(st.id, st.status, st.errors?.[0]?.title);
      }
    }

    if (stored || duplicates) this.log.log(`WhatsApp webhook: ${stored} new, ${duplicates} duplicate`);
    return { stored, duplicates };
  }
}
