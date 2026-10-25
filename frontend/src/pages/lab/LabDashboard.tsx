import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCheck,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Lock,
  PlusCircle,
  Route,
  ThumbsUp,
  Wrench,
} from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import { useToast } from '../../components/ui/Toast';
import AssetIcon from '../../components/tickets/AssetIcon';
import TicketTable from '../../components/tickets/TicketTable';
import { locations } from '../../data/referenceData';
import { resolvedAt } from '../../domain/lifecycle';
import { childrenOf, locationPath, permittedBuildings } from '../../domain/locations';
import { greeting, timeAgo, userName } from '../../domain/format';
import type { Ticket } from '../../domain/types';
import { useCurrentUser } from '../../state/session';
import { useTicketStore, useVisibleTickets } from '../../state/ticketStore';
import './LabDashboard.css';

const howItWorks = [
  { icon: PlusCircle, title: 'Raise', text: 'Photo, asset type, lab and a short description.' },
  { icon: Route, title: 'Auto-routed', text: 'Sent to the Sub-Admin responsible for that lab and asset.' },
  { icon: Wrench, title: 'Fixed', text: 'You can follow progress on the portal.' },
  { icon: ThumbsUp, title: 'Confirm', text: 'Confirm the fix, or dispute it to reopen.' },
];

function labCount(buildingId: string) {
  return childrenOf(buildingId).reduce((n, floor) => n + locations.filter((l) => l.parentId === floor.id).length, 0);
}

export default function LabDashboard() {
  const user = useCurrentUser();
  const tickets = useVisibleTickets(user);
  const { changeStatus } = useTicketStore();
  const [toast, showToast] = useToast();

  const awaiting = tickets.filter((t) => t.status === 'RESOLVED');
  const buildings = permittedBuildings(user);

  async function confirm(t: Ticket) {
    try { await changeStatus(user, t.id, 'CLOSED'); showToast(`Thanks — ${t.id} is now closed`); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Action failed.'); }
  }

  const resolutionNote = (t: Ticket) =>
    [...t.events].reverse().find((e) => e.kind === 'STATUS' && e.to === 'RESOLVED')?.text;

  return (
    <div className="dash">
      <section className="hero hero--user rise-in">
        <div className="hero__text">
          <span className="hero__date">
            {user.title} · {user.employeeId}
          </span>
          <h2>
            {greeting()}, <span>{user.name}</span>
          </h2>
          <p>Report a campus issue in under a minute — we route it to the right team automatically.</p>
        </div>
        <div className="hero__actions">
          <Link to="/app/new" className="btn btn-accent hero__cta">
            <PlusCircle size={20} /> Raise a complaint
          </Link>
        </div>
      </section>

      <section className="kpis kpis--4" aria-label="My tickets at a glance">
        <StatCard index={1} label="Open" value={tickets.filter((t) => t.status === 'OPEN').length} note="Waiting to be accepted" icon={CircleDot} />
        <StatCard index={2} label="In progress" value={tickets.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REOPENED').length} note="Being worked on" icon={Clock3} />
        <StatCard index={3} label="Awaiting you" value={awaiting.length} note="Confirm or dispute the fix" icon={ClipboardCheck} tone="gold" />
        <StatCard index={4} label="Closed" value={tickets.filter((t) => t.status === 'CLOSED').length} note="Confirmed as fixed" icon={Lock} tone="resolved" />
      </section>

      <div className="dash__grid">
        <div className="dash__side">
          {awaiting.length > 0 && (
            <section className="panel glass panel--attention rise-in" style={{ '--i': 5 } as CSSProperties}>
              <header className="panel__head">
                <div>
                  <h3>Action needed</h3>
                  <p>These were marked resolved. Is the problem fixed?</p>
                </div>
                <span className="count-pill">{awaiting.length}</span>
              </header>
              <ul className="confirm-list">
                {awaiting.map((t) => {
                  const at = resolvedAt(t);
                  return (
                    <li key={t.id} className="confirm-item">
                      <span className="confirm-item__icon">
                        <AssetIcon id={t.assetTypeId} size={20} />
                      </span>
                      <div className="confirm-item__body">
                        <Link to={`/app/tickets/${t.id}`} className="t-code">
                          {t.id}
                        </Link>
                        <p className="confirm-item__desc">{t.description}</p>
                        <p className="t-meta">{locationPath(t.locationId)}</p>
                        {resolutionNote(t) && (
                          <blockquote className="confirm-item__note">
                            “{resolutionNote(t)}” — {userName(t.assignedTo)}
                            {at ? `, ${timeAgo(at)}` : ''}
                          </blockquote>
                        )}
                      </div>
                      <div className="confirm-item__actions">
                        <button type="button" className="btn btn-accent" onClick={() => confirm(t)}>
                          <CheckCheck size={16} /> Yes, fixed
                        </button>
                        <Link to={`/app/tickets/${t.id}?dispute=1`} className="btn btn-ghost">
                          Not fixed
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="panel glass rise-in" style={{ '--i': 6 } as CSSProperties}>
            <header className="panel__head">
              <div>
                <h3>My recent tickets</h3>
                <p>Only tickets you raised are shown</p>
              </div>
              <Link to="/app/tickets" className="panel__link">
                View all <ArrowRight size={16} />
              </Link>
            </header>
            <TicketTable
              tickets={tickets.slice(0, 5)}
              basePath="/app"
              showCreator={false}
              showProgress
              emptyText="You have not raised any tickets yet."
            />
          </section>
        </div>

        <div className="dash__side">
          <section className="panel glass rise-in" style={{ '--i': 7 } as CSSProperties}>
            <header className="panel__head">
              <div>
                <h3>Where you can report</h3>
                <p>Set by the Super Admin</p>
              </div>
            </header>
            <ul className="place-list">
              {buildings.map((b) => (
                <li key={b.id}>
                  <span className="place-list__icon">
                    <Building2 size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{b.name}</strong>
                    <small>
                      {childrenOf(b.id).length} floors · {labCount(b.id)} labs / rooms
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel glass rise-in" style={{ '--i': 8 } as CSSProperties}>
            <header className="panel__head">
              <div>
                <h3>How it works</h3>
                <p>Track every update on the portal</p>
              </div>
            </header>
            <ol className="how-list">
              {howItWorks.map(({ icon: Icon, title, text }, i) => (
                <li key={title}>
                  <span className="how-list__num">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>
                      {i + 1}. {title}
                    </strong>
                    <small>{text}</small>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {toast}
    </div>
  );
}
