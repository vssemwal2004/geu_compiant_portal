// Sample tickets for UI development only, built through the same domain operations the
// app uses, so their history and routing follow the real rules. Replaced by GET /tickets.

import { assign, buildTicket, postMessage, ticketCode, transition, type NewTicketInput } from '../domain/ticketOps';
import type { Ticket, TicketStatus, Visibility } from '../domain/types';

const NOW = Date.now();
const H = 60;
const D = 24 * H;
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

type Step =
  | { status: TicketStatus; by: string; at: number; note?: string }
  | { msg: string; by: string; at: number; visibility?: Visibility }
  | { assignTo: string; by: string; at: number; reason?: string };

function seed(seq: number, input: NewTicketInput, createdMin: number, steps: Step[] = []): Ticket {
  let t = buildTicket(input, ticketCode(seq), ago(createdMin));
  for (const s of steps) {
    if ('status' in s) t = transition(t, s.status, s.by, ago(s.at), s.note);
    else if ('msg' in s) t = postMessage(t, s.by, ago(s.at), s.msg, s.visibility ?? 'PUBLIC');
    else t = assign(t, s.assignTo, s.by, ago(s.at), s.reason);
  }
  return t;
}

export const seedTickets: Ticket[] = [
  seed(187, { creatorId: 'u-la-negi', locationId: 'l-gr-205', assetTypeId: 'at-computer', priority: 'HIGH', source: 'WHATSAPP', description: 'System 14 does not boot; stuck on BIOS screen.' }, 12),
  seed(186, { creatorId: 'u-la-bisht', locationId: 'l-gr-104', assetTypeId: 'at-projector', source: 'PORTAL', description: 'Projector display flickering during lectures.' }, 70, [
    { status: 'IN_PROGRESS', by: 'u-sa-grtech', at: 40 },
    { msg: 'Lamp replacement ordered; expected tomorrow.', by: 'u-sa-grtech', at: 35 },
    { msg: 'Vendor purchase order raised.', by: 'u-sa-grtech', at: 30, visibility: 'INTERNAL' },
  ]),
  seed(185, { creatorId: 'u-la-rawat', locationId: 'l-ha-312', assetTypeId: 'at-electrical', priority: 'CRITICAL', source: 'WHATSAPP', description: 'Power socket sparking near study table.' }, 5 * H),
  seed(184, { creatorId: 'u-la-joshi', locationId: 'l-gehu-110', assetTypeId: 'at-furniture', source: 'PORTAL', description: 'Three chairs broken; backrest detached.' }, 5 * H, [
    { status: 'IN_PROGRESS', by: 'u-sa-gehu-mt', at: 4 * H },
    { status: 'RESOLVED', by: 'u-sa-gehu-mt', at: 1 * H, note: 'Replaced three chairs with new stock.' },
  ]),
  seed(183, { creatorId: 'u-la-negi', locationId: 'l-gr-301', assetTypeId: 'at-network', priority: 'HIGH', source: 'PORTAL', description: 'No internet on rows C and D; switch lights off.' }, 27 * H, [
    { status: 'IN_PROGRESS', by: 'u-sa-grit', at: 24 * H },
    { status: 'RESOLVED', by: 'u-sa-grit', at: 6 * H, note: 'Replaced faulty 24-port switch.' },
    { status: 'REOPENED', by: 'u-la-negi', at: 3 * H, note: 'Row D still has no internet.' },
  ]),
  seed(182, { creatorId: 'u-la-thapa', locationId: 'l-gehu-214', assetTypeId: 'at-computer', priority: 'LOW', source: 'WHATSAPP', description: 'Keyboard and mouse not responding on System 3.' }, 30 * H, [
    { status: 'IN_PROGRESS', by: 'u-sa-gehu-it', at: 28 * H },
    { status: 'RESOLVED', by: 'u-sa-gehu-it', at: 26 * H, note: 'Replaced USB hub.' },
    { status: 'CLOSED', by: 'u-la-thapa', at: 20 * H },
  ]),
  seed(181, { creatorId: 'u-la-negi', locationId: 'l-gr-205', assetTypeId: 'at-computer', source: 'PORTAL', description: 'Monitor on System 7 shows no display.' }, 2 * D, [
    { status: 'IN_PROGRESS', by: 'u-sa-grit', at: 40 * H },
    { msg: 'Checking cable and graphics card.', by: 'u-sa-grit', at: 39 * H },
    { status: 'RESOLVED', by: 'u-sa-grit', at: 3 * H, note: 'Loose VGA cable replaced; display tested.' },
  ]),
  seed(180, { creatorId: 'u-la-bisht', locationId: 'l-gr-205', assetTypeId: 'at-computer', source: 'PORTAL', description: 'UPS for row A beeping continuously.' }, 9 * H, [
    { status: 'IN_PROGRESS', by: 'u-sa-grit', at: 6 * H },
  ]),
  seed(179, { creatorId: 'u-la-rana', locationId: 'l-lib-read', assetTypeId: 'at-furniture', priority: 'MEDIUM', source: 'PORTAL', description: 'Reading table leg broken.' }, 1 * D),
  seed(178, { creatorId: 'u-la-negi', locationId: 'l-gr-206', assetTypeId: 'at-other', source: 'WHATSAPP', description: 'Lab door lock jammed; door cannot be locked after class.' }, 20 * H),
  seed(177, { creatorId: 'u-la-joshi', locationId: 'l-gehu-214', assetTypeId: 'at-computer', source: 'WHATSAPP', description: 'Two systems restart randomly during practicals.' }, 3 * H),
  seed(176, { creatorId: 'u-la-panwar', locationId: 'l-adm-corr', assetTypeId: 'at-electrical', source: 'WHATSAPP', description: 'Corridor tube lights not working.' }, 2 * D),
  seed(175, { creatorId: 'u-la-negi', locationId: 'l-gr-205', assetTypeId: 'at-projector', source: 'PORTAL', description: 'Projector remote missing.' }, 4 * D, [
    { status: 'IN_PROGRESS', by: 'u-sa-grtech', at: 4 * D - 2 * H },
    { status: 'RESOLVED', by: 'u-sa-grtech', at: 3 * D + 12 * H, note: 'New remote issued to the lab.' },
    { status: 'CLOSED', by: 'u-la-negi', at: 3 * D + 10 * H },
  ]),
  seed(174, { creatorId: 'u-la-thapa', locationId: 'l-gehu-110', assetTypeId: 'at-furniture', source: 'PORTAL', description: 'Whiteboard loose on wall.' }, 6 * D, [
    { status: 'CANCELLED', by: 'u-admin', at: 5 * D, note: 'Duplicate of an existing maintenance request.' },
  ]),
];
