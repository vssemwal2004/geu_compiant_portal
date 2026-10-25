import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Plus, Search, UserRound, X, type LucideIcon } from 'lucide-react';
import { initials, timeAgo } from '../../domain/format';
import { notificationsFor } from '../../domain/notifications';
import { roleHome, roleLabel, useCurrentUser, useSession } from '../../state/session';
import { useTicketStore } from '../../state/ticketStore';
import './Header.css';

export interface QuickLink {
  to: string;
  label: string;
  icon: LucideIcon;
  count: number;
}

interface Props {
  title: string;
  onOpenMenu: () => void;
  menuOpen: boolean;
  quickLink: QuickLink;
}

type Popover = 'notifications' | 'profile' | null;

export default function Header({ title, onOpenMenu, menuOpen, quickLink }: Props) {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { signOut } = useSession();
  const { tickets } = useTicketStore();
  const home = roleHome[user.role];

  const [popover, setPopover] = useState<Popover>(null);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo(() => notificationsFor(user, tickets), [user, tickets]);
  const unread = notifications.filter((n) => n.unread).length;
  // Sub-Admins work tickets but never create them (PDF §3).
  const canCreate = user.role === 'MAIN_ADMIN' || user.role === 'LAB_ASSISTANT';
  const QuickIcon = quickLink.icon;

  // Ctrl/Cmd + K focuses search; Escape closes popovers.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMobileSearch(true);
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') setPopover(null);
    }
    function onClick(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setPopover(null);
    }
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  useEffect(() => {
    if (mobileSearch) searchRef.current?.focus();
  }, [mobileSearch]);

  const toggle = (p: Exclude<Popover, null>) => setPopover((cur) => (cur === p ? null : p));

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `${home}/tickets?q=${encodeURIComponent(q)}` : `${home}/tickets`);
    setMobileSearch(false);
  }

  function handleSignOut() {
    signOut();
    navigate('/login');
  }

  return (
    <header className={`topbar ${mobileSearch ? 'is-searching' : ''}`}>
      <div className="topbar__left">
        <button
          type="button"
          className="icon-btn topbar__menu"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          aria-controls="app-sidebar"
          aria-expanded={menuOpen}
        >
          <Menu size={20} />
        </button>
        <div className="topbar__title">
          <span className="topbar__crumb">{roleLabel[user.role]}</span>
          <h1>{title}</h1>
        </div>
      </div>

      <form className="topbar__search" role="search" onSubmit={submitSearch}>
        <Search size={18} className="topbar__search-icon" aria-hidden="true" />
        <label htmlFor="global-search" className="sr-only">
          Search tickets
        </label>
        <input
          ref={searchRef}
          id="global-search"
          type="search"
          placeholder={user.role === 'LAB_ASSISTANT' ? 'Search your tickets…' : 'Search ticket ID, lab, asset or person…'}
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd className="topbar__kbd">Ctrl K</kbd>
        <button
          type="button"
          className="icon-btn topbar__search-close"
          onClick={() => setMobileSearch(false)}
          aria-label="Close search"
        >
          <X size={18} />
        </button>
      </form>

      <div className="topbar__actions" ref={actionsRef}>
        <button
          type="button"
          className="icon-btn topbar__search-open"
          onClick={() => setMobileSearch(true)}
          aria-label="Search"
        >
          <Search size={20} />
        </button>

        {canCreate && (
          <Link to={`${home}/new`} className="btn btn-accent topbar__new">
            <Plus size={18} strokeWidth={2.4} />
            <span>{user.role === 'LAB_ASSISTANT' ? 'Raise Complaint' : 'New Ticket'}</span>
          </Link>
        )}

        <Link
          to={quickLink.to}
          className="icon-btn"
          aria-label={`${quickLink.label}: ${quickLink.count}`}
          title={quickLink.label}
        >
          <QuickIcon size={20} />
          {quickLink.count > 0 && <span className="icon-btn__count">{quickLink.count}</span>}
        </Link>

        <div className="popover-anchor">
          <button
            type="button"
            className={`icon-btn ${popover === 'notifications' ? 'is-active' : ''}`}
            onClick={() => toggle('notifications')}
            aria-label={`Notifications, ${unread} unread`}
            aria-expanded={popover === 'notifications'}
            aria-haspopup="true"
          >
            <Bell size={20} className={unread ? 'bell-ring' : ''} />
            {unread > 0 && <span className="icon-btn__dot" />}
          </button>
          {popover === 'notifications' && (
            <div className="popover popover--wide" role="menu">
              <div className="popover__head">
                <strong>Notifications</strong>
                <span>{unread} new</span>
              </div>
              {notifications.length === 0 ? (
                <p className="notif-empty">You are all caught up.</p>
              ) : (
                <ul className="notif-list">
                  {notifications.map((n) => (
                    <li key={n.id} className={n.unread ? 'is-unread' : ''}>
                      <Link to={`${home}/tickets/${n.ticketId}`} onClick={() => setPopover(null)} role="menuitem">
                        <span className="notif-list__bullet" aria-hidden="true" />
                        <span className="notif-list__body">
                          <strong>{n.title}</strong>
                          <small>{n.text}</small>
                        </span>
                        <time dateTime={n.at}>{timeAgo(n.at)}</time>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link to={`${home}/tickets`} className="popover__foot" onClick={() => setPopover(null)}>
                View all tickets
              </Link>
            </div>
          )}
        </div>

        <span className="topbar__divider" aria-hidden="true" />

        <div className="popover-anchor">
          <button
            type="button"
            className={`topbar__profile ${popover === 'profile' ? 'is-active' : ''}`}
            onClick={() => toggle('profile')}
            aria-expanded={popover === 'profile'}
            aria-haspopup="true"
          >
            <span className="avatar">{initials(user.name)}</span>
            <span className="topbar__profile-text">
              <strong>{user.name}</strong>
              <small>{user.title}</small>
            </span>
            <ChevronDown size={16} className="topbar__chevron" />
          </button>
          {popover === 'profile' && (
            <div className="popover" role="menu">
              <div className="popover__who">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
              <Link to={`${home}/profile`} className="popover__item" role="menuitem" onClick={() => setPopover(null)}>
                <UserRound size={17} /> My profile
              </Link>
              <button type="button" className="popover__item popover__item--danger" role="menuitem" onClick={handleSignOut}>
                <LogOut size={17} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
