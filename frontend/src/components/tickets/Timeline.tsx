import { ArrowRightLeft, Camera, CircleDot, EyeOff, Flag, MessageSquareText, Sparkles } from 'lucide-react';
import { formatDate, timeAgo, userName } from '../../domain/format';
import type { TicketEvent } from '../../domain/types';
import { statusMeta } from '../ui/Badges';
import './Timeline.css';

function describe(e: TicketEvent): string {
  switch (e.kind) {
    case 'CREATED':
      return `${userName(e.actorId)} raised this ticket`;
    case 'ASSIGNED':
      if (!e.to) return 'No routing rule matched — waiting in the unassigned queue';
      return e.actorId ? `${userName(e.actorId)} assigned it to ${userName(e.to)}` : `Auto-assigned to ${userName(e.to)}`;
    case 'STATUS': {
      const label = e.to ? statusMeta[e.to as keyof typeof statusMeta]?.label ?? e.to : '';
      return `${userName(e.actorId)} changed status to ${label}`;
    }
    case 'MESSAGE':
      return `${userName(e.actorId)} posted an update`;
    case 'ESCALATION':
      return `${userName(e.actorId)} requested Super Admin intervention`;
    case 'EVIDENCE':
      return `${userName(e.actorId)} uploaded resolution evidence`;
    case 'PRIORITY':
      return `${userName(e.actorId)} changed the priority`;
  }
}

const icons = {
  CREATED: Sparkles,
  ASSIGNED: ArrowRightLeft,
  STATUS: CircleDot,
  MESSAGE: MessageSquareText,
  ESCALATION: Flag,
  EVIDENCE: Camera,
  PRIORITY: Flag,
};

/** Ticket history, newest first. Callers filter out internal events for Lab Assistants. */
export default function Timeline({ events }: { events: TicketEvent[] }) {
  const ordered = [...events].reverse();
  return (
    <ol className="timeline">
      {ordered.map((e) => {
        const Icon = icons[e.kind];
        return (
          <li key={e.id} className={`timeline__item timeline__item--${e.kind.toLowerCase()}`}>
            <span className="timeline__icon">
              <Icon size={15} aria-hidden="true" />
            </span>
            <div className="timeline__body">
              <p className="timeline__title">
                {describe(e)}
                {e.visibility === 'INTERNAL' && (
                  <span className="timeline__internal">
                    <EyeOff size={11} aria-hidden="true" /> Internal
                  </span>
                )}
              </p>
              {e.text && e.kind !== 'ASSIGNED' && <p className="timeline__text">{e.text}</p>}
              <time dateTime={e.at} title={formatDate(e.at)}>
                {timeAgo(e.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
