import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, ArrowRight, CheckCircle2, Clock3, Hourglass, ListChecks, Play, RotateCcw } from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import BarList from '../../components/ui/BarList';
import { PriorityBadge, StatusBadge } from '../../components/ui/Badges';
import { useToast } from '../../components/ui/Toast';
import AssetIcon from '../../components/tickets/AssetIcon';
import TicketTable from '../../components/tickets/TicketTable';
import { assetTypes } from '../../data/mockData';
import { isOverdue, isPendingWork } from '../../domain/lifecycle';
import { locationPath } from '../../domain/locations';
import { dueLabel, greeting, timeAgo, userName } from '../../domain/format';
import type { Ticket, TicketPriority } from '../../domain/types';
import { useCurrentUser } from '../../state/session';
import { useTicketStore, useVisibleTickets } from '../../state/ticketStore';
import './SubAdminDashboard.css';

const PRIORITIES: TicketPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const rank = (t: Ticket) => PRIORITIES.indexOf(t.priority);
const WEEK_MS = 7 * 24 * 3_600_000;

export default function SubAdminDashboard() {
  const user = useCurrentUser();
  const tickets = useVisibleTickets(user);
  const { changeStatus } = useTicketStore();
  const [toast, showToast] = useToast();
  const now = Date.now();

  // Highest priority first, then the one due soonest.
  const needsAction = tickets
    .filter((t) => t.status === 'OPEN' || t.status === 'REOPENED')
    .sort((a, b) => rank(a) - rank(b) || a.dueAt.localeCompare(b.dueAt));
  const working = tickets.filter((t) => t.status === 'IN_PROGRESS');
  const awaitingCreator = tickets.filter((t) => t.status === 'RESOLVED');
  const resolvedWeek = tickets.filter((t) =>
    t.events.some((e) => e.kind === 'STATUS' && e.to === 'RESOLVED' && e.actorId === user.id && now - new Date(e.at).getTime() < WEEK_MS),
  ).length;

  function start(t: Ticket) {
    changeStatus(user, t.id, 'IN_PROGRESS');
    showToast(`${t.id} is now in progress`);
  }

  return (
    <div className="dash">
      <section className="hero rise-in">
        <div className="hero__text">
          <span className="hero__date">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="hero__sample">Sample data</span>
          </span>
          <h2>
            {greeting()}, <span>{user.name}</span>
          </h2>
          <p>
            {needsAction.length > 0
              ? `${needsAction.length} ticket${needsAction.length > 1 ? 's' : ''} need your attention.`
              : 'Your queue is clear — nice work.'}
          </p>
        </div>
        <div className="hero__actions">
          <Link to="/sub-admin/tickets" className="btn btn-accent">
            <ListChecks size={18} /> Open my queue
          </Link>
        </div>
      </section>

      <section className="kpis" aria-label="Key figures">
        <StatCard index={1} label="New" value={tickets.filter((t) => t.status === 'OPEN').length} note="Waiting for you to accept" icon={Hourglass} tone="gold" />
        <StatCard index={2} label="In progress" value={working.length} note="You are working on" icon={Clock3} />
        <StatCard index={3} label="Reopened" value={tickets.filter((t) => t.status === 'REOPENED').length} note="Disputed by the creator" icon={RotateCcw} />
        <StatCard index={4} label="Overdue" value={tickets.filter((t) => isOverdue(t, now)).length} note="Past SLA due time" icon={AlarmClock} tone="critical" />
        <StatCard index={5} label="Resolved · 7 days" value={resolvedWeek} note="Resolved by you this week" icon={CheckCircle2} tone="resolved" />
      </section>

      <div className="dash__grid">
        <section className="panel glass rise-in" style={{ '--i': 6 } as CSSProperties}>
          <header className="panel__head">
            <div>
              <h3>Needs your action</h3>
              <p>New and reopened tickets, most urgent first</p>
            </div>
            <span className="count-pill">{needsAction.length}</span>
          </header>

          {needsAction.length === 0 ? (
            <p className="empty">Nothing waiting. New assignments will appear here instantly.</p>
          ) : (
            <ul className="action-list">
              {needsAction.map((t) => (
                <li key={t.id} className="action-item">
                  <span className="action-item__icon">
                    <AssetIcon id={t.assetTypeId} size={20} />
                  </span>
                  <div className="action-item__body">
                    <div className="action-item__row">
                      <Link to={`/sub-admin/tickets/${t.id}`} className="t-code">
                        {t.id}
                      </Link>
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <p className="action-item__desc">{t.description}</p>
                    <p className="t-meta">
                      {assetTypes.find((a) => a.id === t.assetTypeId)?.name} · {locationPath(t.locationId)} · {userName(t.creatorId)} · {timeAgo(t.createdAt)}
                    </p>
                  </div>
                  <div className="action-item__side">
                    <span className={`due ${isOverdue(t, now) ? 'due--late' : ''}`}>{dueLabel(t.dueAt, now)}</span>
                    <button type="button" className="btn btn-primary action-item__btn" onClick={() => start(t)}>
                      <Play size={15} /> {t.status === 'REOPENED' ? 'Resume' : 'Accept'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="dash__side">
          <section className="panel glass rise-in" style={{ '--i': 7 } as CSSProperties}>
            <header className="panel__head">
              <div>
                <h3>Pending by priority</h3>
                <p>Your open, in-progress and reopened tickets</p>
              </div>
            </header>
            <BarList
              items={PRIORITIES.map((p) => ({
                key: p,
                label: <PriorityBadge priority={p} />,
                name: p.charAt(0) + p.slice(1).toLowerCase(),
                value: tickets.filter((t) => isPendingWork(t) && t.priority === p).length,
              }))}
            />
          </section>

          <section className="panel glass rise-in" style={{ '--i': 8 } as CSSProperties}>
            <header className="panel__head">
              <div>
                <h3>Awaiting confirmation</h3>
                <p>Resolved by you; the lab assistant confirms or disputes</p>
              </div>
            </header>
            {awaitingCreator.length === 0 ? (
              <p className="empty">No resolutions pending.</p>
            ) : (
              <ul className="queue">
                {awaitingCreator.map((t) => (
                  <li key={t.id} className="queue__item">
                    <div className="queue__body">
                      <Link to={`/sub-admin/tickets/${t.id}`} className="t-code">
                        {t.id}
                      </Link>
                      <span className="t-meta">{userName(t.creatorId)} · {locationPath(t.locationId)}</span>
                    </div>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="panel glass rise-in" style={{ '--i': 9 } as CSSProperties}>
        <header className="panel__head">
          <div>
            <h3>Working on</h3>
            <p>Tickets you have accepted</p>
          </div>
          <Link to="/sub-admin/tickets?status=IN_PROGRESS" className="panel__link">
            View all <ArrowRight size={16} />
          </Link>
        </header>
        <TicketTable tickets={working} basePath="/sub-admin" showAssignee={false} emptyText="You have no tickets in progress." />
      </section>

      {toast}
    </div>
  );
}
