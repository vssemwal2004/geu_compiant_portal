import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Eye,
  EyeOff,
  Flag,
  ImageOff,
  MapPin,
  MessageCircle,
  Monitor,
  SearchX,
  Send,
  UserCheck,
} from 'lucide-react';
import AssetIcon from '../../components/tickets/AssetIcon';
import StatusStepper from '../../components/tickets/StatusStepper';
import Timeline from '../../components/tickets/Timeline';
import { PriorityBadge, StatusBadge } from '../../components/ui/Badges';
import { useToast } from '../../components/ui/Toast';
import { assetTypes, users } from '../../data/mockData';
import {
  availableTransitions,
  canAssign,
  canEscalate,
  canPostUpdate,
  canSeeInternal,
  canView,
  isOverdue,
  SLA_HOURS,
  type TransitionOption,
} from '../../domain/lifecycle';
import { locationPath } from '../../domain/locations';
import { dueLabel, formatDate, timeAgo, userName } from '../../domain/format';
import type { Ticket, User, Visibility } from '../../domain/types';
import { roleHome, useCurrentUser } from '../../state/session';
import { useTicketStore } from '../../state/ticketStore';
import './TicketDetailPage.css';

export default function TicketDetailPage() {
  const { id } = useParams();
  const user = useCurrentUser();
  const home = roleHome[user.role];
  const { tickets } = useTicketStore();
  const ticket = tickets.find((t) => t.id === id);

  // Same answer for "does not exist" and "not yours", so ticket IDs cannot be probed.
  if (!ticket || !canView(user, ticket)) {
    return (
      <section className="panel glass notfound rise-in">
        <SearchX size={36} />
        <h2>Ticket not found</h2>
        <p>It may not exist, or it is not visible to your account.</p>
        <Link to={`${home}/tickets`} className="btn btn-ghost">
          <ArrowLeft size={16} /> Back to tickets
        </Link>
      </section>
    );
  }

  return <Detail ticket={ticket} user={user} home={home} />;
}

function Detail({ ticket: t, user, home }: { ticket: Ticket; user: User; home: string }) {
  const [toast, showToast] = useToast();
  const asset = assetTypes.find((a) => a.id === t.assetTypeId);
  const events = canSeeInternal(user) ? t.events : t.events.filter((e) => e.visibility === 'PUBLIC');
  const overdue = isOverdue(t);

  return (
    <div className="dash ticket">
      <div className="page-head">
        <div>
          <Link to={`${home}/tickets`} className="back-link">
            <ArrowLeft size={16} /> Tickets
          </Link>
          <h2 className="ticket__code">{t.id}</h2>
          <div className="ticket__badges">
            <StatusBadge status={t.status} />
            <PriorityBadge priority={t.priority} />
            {overdue && <span className="t-overdue t-overdue--inline">Overdue</span>}
            <span className="ticket__source">
              {t.source === 'WHATSAPP' ? <MessageCircle size={14} /> : <Monitor size={14} />}
              {t.source === 'WHATSAPP' ? 'WhatsApp' : 'Portal'}
            </span>
          </div>
        </div>
      </div>

      <div className="ticket__grid">
        <div className="ticket__main">
          <section className="panel glass rise-in">
            <div className="issue">
              <div className="issue__photo">
                {t.imageUrl ? (
                  <img src={t.imageUrl} alt="Photo attached to this ticket" />
                ) : (
                  <span className="issue__nophoto">
                    <ImageOff size={26} />
                    <small>{t.source === 'WHATSAPP' ? 'Photo received via WhatsApp' : 'Photo attached'}</small>
                    <small className="issue__nophoto-note">Preview available once storage is connected</small>
                  </span>
                )}
              </div>
              <div className="issue__body">
                <span className="issue__asset">
                  <AssetIcon id={t.assetTypeId} size={18} /> {asset?.name}
                </span>
                <p className="issue__desc">{t.description}</p>
                <p className="issue__loc">
                  <MapPin size={15} /> {locationPath(t.locationId)}
                </p>
              </div>
            </div>

            <dl className="facts">
              <div>
                <dt>Raised by</dt>
                <dd>{userName(t.creatorId)}</dd>
              </div>
              <div>
                <dt>Assigned to</dt>
                <dd>{t.assignedTo ? userName(t.assignedTo) : user.role === 'LAB_ASSISTANT' ? 'Being assigned' : 'Unassigned'}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd title={formatDate(t.createdAt)}>{timeAgo(t.createdAt)}</dd>
              </div>
              <div>
                <dt>SLA ({SLA_HOURS[t.priority]} h)</dt>
                <dd className={overdue ? 'facts__late' : ''}>
                  <CalendarClock size={14} /> {t.status === 'CLOSED' || t.status === 'CANCELLED' ? formatDate(t.dueAt) : dueLabel(t.dueAt)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel glass rise-in" style={{ animationDelay: '80ms' }}>
            <header className="panel__head">
              <div>
                <h3>Progress</h3>
              </div>
            </header>
            <StatusStepper status={t.status} />
          </section>

          <section className="panel glass rise-in" style={{ animationDelay: '160ms' }}>
            <header className="panel__head">
              <div>
                <h3>Activity</h3>
                <p>
                  {canSeeInternal(user)
                    ? 'Full history, including internal staff notes.'
                    : 'Updates from you and the maintenance team.'}
                </p>
              </div>
            </header>
            {canPostUpdate(user, t) && <Composer ticket={t} user={user} onDone={showToast} />}
            <Timeline events={events} />
          </section>
        </div>

        <aside className="ticket__side">
          <Actions ticket={t} user={user} onDone={showToast} />
          {canAssign(user) && <AssignPanel ticket={t} user={user} onDone={showToast} />}
          {canEscalate(user, t) && <EscalatePanel ticket={t} user={user} onDone={showToast} />}
        </aside>
      </div>
      {toast}
    </div>
  );
}

/* ---------- Status actions ---------- */
function Actions({ ticket: t, user, onDone }: { ticket: Ticket; user: User; onDone: (m: string) => void }) {
  const { changeStatus } = useTicketStore();
  const [params] = useSearchParams();
  const options = availableTransitions(t, user);
  const preset = params.get('dispute') === '1' ? options.find((o) => o.to === 'REOPENED') ?? null : null;
  const [pending, setPending] = useState<TransitionOption | null>(preset);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  function run(o: TransitionOption) {
    if (o.noteLabel && !pending) {
      setPending(o);
      setNote('');
      setError('');
      return;
    }
    if (o.noteLabel && !note.trim()) {
      setError('Please add a short note.');
      return;
    }
    changeStatus(user, t.id, o.to, note);
    setPending(null);
    setNote('');
    onDone(`${t.id}: ${o.label.toLowerCase()} — done`);
  }

  return (
    <section className="panel glass rise-in actions">
      <header className="panel__head">
        <div>
          <h3>Actions</h3>
          <p>{hint(t, user, options.length)}</p>
        </div>
      </header>

      {pending ? (
        <div className="actions__note reveal">
          <label htmlFor="action-note" className="form-label">
            {pending.noteLabel}
          </label>
          <textarea
            id="action-note"
            className="textarea"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
          {error && <p className="form-error">{error}</p>}
          <div className="actions__row">
            <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className={`btn btn-${pending.tone === 'ghost' ? 'primary' : pending.tone}`} onClick={() => run(pending)}>
              {pending.label}
            </button>
          </div>
        </div>
      ) : (
        options.length > 0 && (
          <div className="actions__list">
            {options.map((o) => (
              <button key={o.to + o.label} type="button" className={`btn btn-${o.tone}`} onClick={() => run(o)}>
                {o.label}
              </button>
            ))}
          </div>
        )
      )}
    </section>
  );
}

function hint(t: Ticket, user: User, count: number): string {
  if (count > 0) {
    if (t.status === 'RESOLVED' && user.role === 'LAB_ASSISTANT') return 'Is the problem fixed? Your answer closes or reopens the ticket.';
    return 'Choose the next step for this ticket.';
  }
  switch (t.status) {
    case 'OPEN':
      return t.assignedTo ? `Waiting for ${userName(t.assignedTo)} to accept.` : 'Waiting for the Main Admin to assign a team.';
    case 'IN_PROGRESS':
    case 'REOPENED':
      return `${userName(t.assignedTo)} is working on it.`;
    case 'RESOLVED':
      return `Waiting for ${userName(t.creatorId)} to confirm the fix.`;
    case 'CLOSED':
      return 'This ticket is closed.';
    case 'CANCELLED':
      return 'This ticket was cancelled.';
  }
}

/* ---------- Updates & internal notes ---------- */
function Composer({ ticket: t, user, onDone }: { ticket: Ticket; user: User; onDone: (m: string) => void }) {
  const { addUpdate } = useTicketStore();
  const staff = canSeeInternal(user);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    addUpdate(user, t.id, body, visibility);
    setBody('');
    onDone(visibility === 'INTERNAL' ? 'Internal note added' : 'Update posted');
  }

  return (
    <form className={`composer ${visibility === 'INTERNAL' ? 'composer--internal' : ''}`} onSubmit={submit}>
      {staff && (
        <div className="composer__tabs" role="radiogroup" aria-label="Visibility">
          <button type="button" role="radio" aria-checked={visibility === 'PUBLIC'} className={visibility === 'PUBLIC' ? 'is-active' : ''} onClick={() => setVisibility('PUBLIC')}>
            <Eye size={14} /> Update to lab assistant
          </button>
          <button type="button" role="radio" aria-checked={visibility === 'INTERNAL'} className={visibility === 'INTERNAL' ? 'is-active' : ''} onClick={() => setVisibility('INTERNAL')}>
            <EyeOff size={14} /> Internal note
          </button>
        </div>
      )}
      <label htmlFor="composer" className="sr-only">
        Message
      </label>
      <textarea
        id="composer"
        className="textarea"
        rows={2}
        placeholder={visibility === 'INTERNAL' ? 'Visible to staff only — never sent on WhatsApp' : 'Add an update…'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="composer__foot">
        <small>{visibility === 'INTERNAL' ? 'Staff only' : staff ? 'The lab assistant is notified' : 'The assigned team is notified'}</small>
        <button type="submit" className="btn btn-primary" disabled={!body.trim()}>
          <Send size={15} /> Post
        </button>
      </div>
    </form>
  );
}

/* ---------- Main Admin: reassign ---------- */
function AssignPanel({ ticket: t, user, onDone }: { ticket: Ticket; user: User; onDone: (m: string) => void }) {
  const { reassign } = useTicketStore();
  const subAdmins = users.filter((u) => u.role === 'SUB_ADMIN');
  const [assignee, setAssignee] = useState(t.assignedTo ?? '');
  const [reason, setReason] = useState('');
  const closed = t.status === 'CLOSED' || t.status === 'CANCELLED';

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!assignee || assignee === t.assignedTo) return;
    reassign(user, t.id, assignee, reason);
    setReason('');
    onDone(`Assigned to ${userName(assignee)}`);
  }

  return (
    <section className="panel glass rise-in">
      <header className="panel__head">
        <div>
          <h3>{t.assignedTo ? 'Reassign' : 'Assign a Sub-Admin'}</h3>
          <p>{t.assignedTo ? `Currently ${userName(t.assignedTo)}` : 'No routing rule matched this ticket.'}</p>
        </div>
      </header>
      <form className="stack" onSubmit={submit}>
        <label htmlFor="assignee" className="sr-only">
          Sub-Admin
        </label>
        <select id="assignee" className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={closed}>
          <option value="">Select Sub-Admin…</option>
          {subAdmins.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={closed}
          aria-label="Reason"
        />
        <button type="submit" className="btn btn-primary" disabled={closed || !assignee || assignee === t.assignedTo}>
          <UserCheck size={16} /> {t.assignedTo ? 'Reassign' : 'Assign'}
        </button>
        {!t.assignedTo && (
          <p className="form-hint">Tip: add a routing rule for this location and asset so future tickets route automatically.</p>
        )}
      </form>
    </section>
  );
}

/* ---------- Sub-Admin: escalate to Main Admin ---------- */
function EscalatePanel({ ticket: t, user, onDone }: { ticket: Ticket; user: User; onDone: (m: string) => void }) {
  const { requestEscalation } = useTicketStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    requestEscalation(user, t.id, reason);
    setReason('');
    setOpen(false);
    onDone('Escalation sent to the Main Admin');
  }

  return (
    <section className="panel glass rise-in">
      <header className="panel__head">
        <div>
          <h3>Need help?</h3>
          <p>Wrong team, or needs another department? Ask the Main Admin to reassign.</p>
        </div>
      </header>
      {open ? (
        <form className="stack reveal" onSubmit={submit}>
          <label htmlFor="esc" className="form-label">
            Reason
          </label>
          <textarea id="esc" className="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          <div className="actions__row">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger" disabled={!reason.trim()}>
              <Flag size={15} /> Send request
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-ghost stack__full" onClick={() => setOpen(true)}>
          <Flag size={15} /> Request escalation
        </button>
      )}
    </section>
  );
}
