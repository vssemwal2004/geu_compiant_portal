import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, ArrowRight, CheckCircle2, ClipboardList, Clock3, GitBranch, Inbox, UserPlus } from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import BarList from '../../components/ui/BarList';
import { PriorityBadge } from '../../components/ui/Badges';
import TicketTable from '../../components/tickets/TicketTable';
import { assetTypes, locations } from '../../data/mockData';
import { isActive, isOverdue, isPendingWork } from '../../domain/lifecycle';
import { ancestorOfType, locationPath } from '../../domain/locations';
import { greeting } from '../../domain/format';
import type { TicketPriority, TicketStatus } from '../../domain/types';
import { useCurrentUser } from '../../state/session';
import { useVisibleTickets } from '../../state/ticketStore';

const filters: { key: 'ALL' | TicketStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'RESOLVED', label: 'Resolved' },
];

const PRIORITIES: TicketPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const WEEK_MS = 7 * 24 * 3_600_000;

export default function DashboardPage() {
  const user = useCurrentUser();
  const tickets = useVisibleTickets(user);
  const [filter, setFilter] = useState<(typeof filters)[number]['key']>('ALL');

  const now = Date.now();
  const unassigned = tickets.filter((t) => t.assignedTo === null && isActive(t));
  const resolvedWeek = tickets.filter((t) =>
    t.events.some((e) => e.kind === 'STATUS' && e.to === 'RESOLVED' && now - new Date(e.at).getTime() < WEEK_MS),
  ).length;

  const rows = (filter === 'ALL' ? tickets : tickets.filter((t) => t.status === filter)).slice(0, 6);
  const activeIndex = filters.findIndex((f) => f.key === filter);

  const byBuilding = locations
    .filter((l) => l.type === 'BUILDING')
    .map((b) => ({
      key: b.id,
      label: b.name,
      name: b.name,
      value: tickets.filter((t) => ancestorOfType(t.locationId, 'BUILDING')?.id === b.id).length,
    }))
    .sort((a, b) => b.value - a.value);

  const byPriority = PRIORITIES.map((p) => ({
    key: p,
    label: <PriorityBadge priority={p} />,
    name: p.charAt(0) + p.slice(1).toLowerCase(),
    value: tickets.filter((t) => isPendingWork(t) && t.priority === p).length,
  }));

  return (
    <div className="dash">
      <section className="hero rise-in">
        <div className="hero__text">
          <span className="hero__date">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            <span className="hero__sample">Sample data</span>
          </span>
          <h2>
            {greeting()}, <span>Admin</span>
          </h2>
          <p>Here is what is happening across campus today.</p>
        </div>
        <div className="hero__actions">
          <Link to="/admin/users" className="btn btn-accent">
            <UserPlus size={18} /> Add user
          </Link>
          <Link to="/admin/routing-rules" className="btn hero__btn-glass">
            <GitBranch size={18} /> Routing rule
          </Link>
        </div>
      </section>

      <section className="kpis" aria-label="Key figures">
        <StatCard index={1} label="Open tickets" value={tickets.filter((t) => t.status === 'OPEN').length} note="Awaiting acceptance" icon={ClipboardList} />
        <StatCard index={2} label="In progress" value={tickets.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REOPENED').length} note="Being worked on" icon={Clock3} />
        <StatCard index={3} label="Unassigned" value={unassigned.length} note="No routing rule matched" icon={Inbox} tone="gold" />
        <StatCard index={4} label="Overdue" value={tickets.filter((t) => isOverdue(t, now)).length} note="Past SLA due time" icon={AlarmClock} tone="critical" />
        <StatCard index={5} label="Resolved · 7 days" value={resolvedWeek} note="Marked resolved this week" icon={CheckCircle2} tone="resolved" />
      </section>

      <div className="dash__grid">
        <section className="panel glass rise-in" style={{ '--i': 6 } as CSSProperties}>
          <header className="panel__head panel__head--stack">
            <div>
              <h3>Recent tickets</h3>
              <p>Latest activity across all locations</p>
            </div>
            <div
              className="segmented"
              role="tablist"
              aria-label="Filter by status"
              style={{ '--seg-index': activeIndex, '--seg-count': filters.length } as CSSProperties}
            >
              <span className="segmented__thumb" aria-hidden="true" />
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  className={filter === f.key ? 'is-active' : ''}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </header>

          <TicketTable tickets={rows} basePath="/admin" emptyText="No tickets with this status." />

          <Link to="/admin/tickets" className="panel__more">
            View all tickets <ArrowRight size={16} />
          </Link>
        </section>

        <div className="dash__side">
          <section className="panel glass rise-in" style={{ '--i': 7 } as CSSProperties}>
            <header className="panel__head">
              <div>
                <h3>Unassigned queue</h3>
                <p>Needs a routing rule or manual assignment</p>
              </div>
              <span className="count-pill">{unassigned.length}</span>
            </header>
            {unassigned.length === 0 ? (
              <p className="empty">Every ticket has an owner.</p>
            ) : (
              <ul className="queue">
                {unassigned.map((t) => (
                  <li key={t.id} className="queue__item">
                    <div className="queue__body">
                      <Link to={`/admin/tickets/${t.id}`} className="t-code">
                        {t.id}
                      </Link>
                      <span className="t-meta">
                        {assetTypes.find((a) => a.id === t.assetTypeId)?.name} · {locationPath(t.locationId)}
                      </span>
                    </div>
                    <PriorityBadge priority={t.priority} />
                    <Link to={`/admin/tickets/${t.id}`} className="queue__assign">
                      Assign
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel glass rise-in" style={{ '--i': 8 } as CSSProperties}>
            <header className="panel__head">
              <div>
                <h3>Pending by priority</h3>
                <p>Open, in-progress and reopened tickets</p>
              </div>
            </header>
            <BarList items={byPriority} />
          </section>
        </div>
      </div>

      <section className="panel glass rise-in" style={{ '--i': 9 } as CSSProperties}>
        <header className="panel__head">
          <div>
            <h3>Tickets by building</h3>
            <p>All tickets · {tickets.length} total</p>
          </div>
          <Link to="/admin/reports" className="panel__link">
            Reports <ArrowRight size={16} />
          </Link>
        </header>
        <BarList items={byBuilding} wide />
      </section>
    </div>
  );
}
