import { Link, useNavigate } from 'react-router-dom';
import { MapPin, MessageCircle, Monitor } from 'lucide-react';
import { assetTypes } from '../../data/referenceData';
import { isOverdue } from '../../domain/lifecycle';
import { locationPath } from '../../domain/locations';
import { timeAgo, userName } from '../../domain/format';
import type { Ticket } from '../../domain/types';
import { PriorityBadge, StatusBadge } from '../ui/Badges';
import StatusStepper from './StatusStepper';

interface Props {
  tickets: Ticket[];
  /** e.g. "/admin" — rows link to `${basePath}/tickets/:id` */
  basePath: string;
  showAssignee?: boolean;
  showCreator?: boolean;
  /** Mobile cards show a progress stepper (useful for the person who raised the ticket). */
  showProgress?: boolean;
  emptyText?: string;
}

const assetName = (id: string) => assetTypes.find((a) => a.id === id)?.name ?? 'Asset';

function SourceIcon({ source }: { source: Ticket['source'] }) {
  return source === 'WHATSAPP' ? (
    <MessageCircle size={14} aria-label="Raised via WhatsApp" />
  ) : (
    <Monitor size={14} aria-label="Raised via portal" />
  );
}

/** Ticket list: a table on desktop and tablet, cards on phones. */
export default function TicketTable({
  tickets,
  basePath,
  showAssignee = true,
  showCreator = true,
  showProgress = false,
  emptyText = 'No tickets to show.',
}: Props) {
  const navigate = useNavigate();
  const href = (t: Ticket) => `${basePath}/tickets/${t.id}`;

  if (tickets.length === 0) return <p className="empty">{emptyText}</p>;

  return (
    <>
      <div className="table-wrap">
        <table className="tickets-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Asset &amp; location</th>
              <th>Priority</th>
              <th>Status</th>
              {showAssignee && <th>Assigned to</th>}
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="is-clickable" onClick={() => navigate(href(t))}>
                <td>
                  <Link to={href(t)} className="t-code" onClick={(e) => e.stopPropagation()}>
                    {t.id}
                  </Link>
                  <span className="t-meta">
                    <SourceIcon source={t.source} />
                    {showCreator ? `${userName(t.creatorId)} · ` : ''}
                    {timeAgo(t.createdAt)}
                  </span>
                </td>
                <td>
                  <span className="t-asset">{assetName(t.assetTypeId)}</span>
                  <span className="t-meta">{locationPath(t.locationId)}</span>
                </td>
                <td>
                  <PriorityBadge priority={t.priority} />
                </td>
                <td>
                  <StatusBadge status={t.status} />
                  {isOverdue(t) && <span className="t-overdue">Overdue</span>}
                </td>
                {showAssignee && (
                  <td>
                    {t.assignedTo ? (
                      <span className="t-assignee">{userName(t.assignedTo)}</span>
                    ) : (
                      <span className="t-unassigned">Unassigned</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="ticket-cards">
        {tickets.map((t) => (
          <li key={t.id}>
            <Link to={href(t)} className="ticket-card">
              <div className="ticket-card__top">
                <span className="t-code">{t.id}</span>
                <StatusBadge status={t.status} />
              </div>
              <p className="ticket-card__desc">{t.description}</p>
              <p className="ticket-card__loc">
                <MapPin size={14} aria-hidden="true" /> {assetName(t.assetTypeId)} · {locationPath(t.locationId)}
              </p>
              {showProgress && <StatusStepper status={t.status} compact />}
              <div className="ticket-card__foot">
                <PriorityBadge priority={t.priority} />
                {isOverdue(t) && <span className="t-overdue t-overdue--inline">Overdue</span>}
                <span className="t-meta">
                  <SourceIcon source={t.source} /> {timeAgo(t.createdAt)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
