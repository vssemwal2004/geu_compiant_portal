import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Pin, PinOff, X } from 'lucide-react';
import seal from '../../assets/geu-seal.png';
import type { NavGroup } from '../../config/navigation';
import { initials } from '../../domain/format';
import { roleHome, roleLabel, useCurrentUser, useSession } from '../../state/session';
import './Sidebar.css';

interface Props {
  nav: NavGroup[];
  /** Live counts keyed by nav path, e.g. unassigned tickets. */
  badges?: Record<string, number>;
  pinned: boolean;
  onTogglePin: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ nav, badges = {}, pinned, onTogglePin, mobileOpen, onCloseMobile }: Props) {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { signOut } = useSession();

  return (
    <>
      <div
        className={`sidebar-backdrop ${mobileOpen ? 'is-visible' : ''}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        className={`sidebar ${pinned ? 'is-pinned' : ''} ${mobileOpen ? 'is-open' : ''}`}
        aria-label="Main navigation"
      >
        <div className="sidebar__brand">
          <span className="sidebar__seal">
            <img src={seal} alt="" />
          </span>
          <span className="sidebar__brand-text sidebar__fade">
            <strong>Graphic Era</strong>
            <small>{roleLabel[user.role]} Portal</small>
          </span>
          <button
            type="button"
            className="sidebar__icon-btn sidebar__pin sidebar__fade"
            onClick={onTogglePin}
            aria-pressed={pinned}
            aria-label={pinned ? 'Unpin sidebar' : 'Keep sidebar open'}
            title={pinned ? 'Unpin sidebar' : 'Keep sidebar open'}
          >
            {pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
          <button
            type="button"
            className="sidebar__icon-btn sidebar__close"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {nav.map((group) => (
            <div key={group.title} className="sidebar__group">
              <p className="sidebar__group-title sidebar__fade">{group.title}</p>
              <ul>
                {group.items.map(({ label, path, icon: Icon }) => {
                  const badge = badges[path];
                  return (
                    <li key={path}>
                      <NavLink
                        to={path}
                        end={path === roleHome[user.role]}
                        className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}
                        onClick={onCloseMobile}
                      >
                        <span className="sidebar__link-icon">
                          <Icon size={20} strokeWidth={1.9} />
                          {badge ? <span className="sidebar__dot" aria-hidden="true" /> : null}
                        </span>
                        <span className="sidebar__link-label sidebar__fade">{label}</span>
                        {badge ? (
                          <span className="sidebar__badge sidebar__fade" aria-label={`${badge} items`}>
                            {badge}
                          </span>
                        ) : null}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <span className="avatar avatar--gold">{initials(user.name)}</span>
            <span className="sidebar__user-text sidebar__fade">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
          </div>
          <button
            type="button"
            className="sidebar__link sidebar__logout"
            onClick={() => {
              signOut();
              navigate('/login');
            }}
          >
            <span className="sidebar__link-icon">
              <LogOut size={20} strokeWidth={1.9} />
            </span>
            <span className="sidebar__link-label sidebar__fade">Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
