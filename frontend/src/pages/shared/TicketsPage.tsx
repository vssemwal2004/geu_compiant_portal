import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import TicketTable from '../../components/tickets/TicketTable';
import { assetTypes } from '../../data/referenceData';
import { isActive, isOverdue } from '../../domain/lifecycle';
import { locationPath } from '../../domain/locations';
import { userName } from '../../domain/format';
import type { TicketPriority, TicketStatus } from '../../domain/types';
import { roleHome, useCurrentUser } from '../../state/session';
import { useVisibleTickets } from '../../state/ticketStore';
import './TicketsPage.css';

const STATUS_FILTERS: { key: TicketStatus | 'ALL' | 'OVERDUE'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'REOPENED', label: 'Reopened' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'OVERDUE', label: 'Overdue' },
];

const PRIORITIES: TicketPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const copy = {
  MAIN_ADMIN: { title: 'All tickets', lead: 'Every ticket across campus.' },
  SUB_ADMIN: { title: 'Assigned tickets', lead: 'Only tickets assigned to you are shown.' },
  LAB_ASSISTANT: { title: 'My tickets', lead: 'Tickets you raised through the portal.' },
};

export default function TicketsPage({ unassignedOnly = false }: { unassignedOnly?: boolean }) {
  const user = useCurrentUser();
  const home = roleHome[user.role];
  const all = useVisibleTickets(user);
  const [params, setParams] = useSearchParams();

  const status = params.get('status') ?? 'ALL';
  const priority = params.get('priority') ?? '';
  const q = params.get('q') ?? '';

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== 'ALL') next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const scoped = useMemo(
    () => (unassignedOnly ? all.filter((t) => t.assignedTo === null && isActive(t)) : all),
    [all, unassignedOnly],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return scoped.filter((t) => {
      if (status === 'OVERDUE' ? !isOverdue(t) : status !== 'ALL' && t.status !== status) return false;
      if (priority && t.priority !== priority) return false;
      if (!needle) return true;
      const hay = [
        t.id,
        t.description,
        locationPath(t.locationId),
        assetTypes.find((a) => a.id === t.assetTypeId)?.name ?? '',
        userName(t.creatorId),
        userName(t.assignedTo),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [scoped, status, priority, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: scoped.length, OVERDUE: scoped.filter((t) => isOverdue(t)).length };
    for (const t of scoped) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [scoped]);

  const head = unassignedOnly
    ? { title: 'Unassigned queue', lead: 'Tickets no routing rule matched. Open one to assign a Sub-Admin.' }
    : copy[user.role];

  return (
    <div className="dash">
      <div className="page-head">
        <div>
          <h2>{head.title}</h2>
          <p>{head.lead}</p>
        </div>
        {user.role === 'LAB_ASSISTANT' && (
          <Link to={`${home}/new`} className="btn btn-accent">
            <Plus size={18} /> Raise complaint
          </Link>
        )}
      </div>

      <section className="panel glass">
        <div className="filters">
          <div className="filters__search">
            <Search size={17} aria-hidden="true" />
            <label htmlFor="ticket-search" className="sr-only">
              Search tickets
            </label>
            <input
              id="ticket-search"
              className="input"
              type="search"
              placeholder="Search ID, description, lab, person…"
              value={q}
              onChange={(e) => setParam('q', e.target.value)}
            />
          </div>
          <label htmlFor="prio" className="sr-only">
            Priority
          </label>
          <select id="prio" className="select filters__select" value={priority} onChange={(e) => setParam('priority', e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="status-tabs" role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={status === f.key}
              className={`status-tab ${status === f.key ? 'is-active' : ''} ${f.key === 'OVERDUE' ? 'status-tab--late' : ''}`}
              onClick={() => setParam('status', f.key)}
            >
              {f.label}
              <span>{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {(q || priority || status !== 'ALL') && (
          <p className="filters__summary">
            {rows.length} of {scoped.length} tickets
            <button type="button" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              <X size={14} /> Clear filters
            </button>
          </p>
        )}

        <TicketTable
          tickets={rows}
          basePath={home}
          showAssignee={user.role !== 'SUB_ADMIN'}
          showCreator={user.role !== 'LAB_ASSISTANT'}
          showProgress={user.role === 'LAB_ASSISTANT'}
          emptyText={scoped.length === 0 ? 'No tickets yet.' : 'No tickets match these filters.'}
        />
      </section>
    </div>
  );
}
