import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ClipboardCheck, Inbox, ListChecks } from 'lucide-react';
import Sidebar from '../components/layout/Sidebar';
import Header, { type QuickLink } from '../components/layout/Header';
import { navByRole } from '../config/navigation';
import { useEdgeSwipe } from '../hooks/useEdgeSwipe';
import { roleHome, useSession } from '../state/session';
import { useVisibleTickets } from '../state/ticketStore';
import { isActive } from '../domain/lifecycle';
import type { Role, Ticket, User } from '../domain/types';
import './AppLayout.css';

const PIN_KEY = 'geu.sidebarPinned';

function readPinned() {
  try {
    return localStorage.getItem(PIN_KEY) === '1';
  } catch {
    return false;
  }
}

/** The header shortcut and sidebar badge each role cares about most. */
function quickLinkFor(user: User, tickets: Ticket[]): QuickLink {
  switch (user.role) {
    case 'MAIN_ADMIN':
      return {
        to: '/admin/unassigned',
        label: 'Unassigned tickets',
        icon: Inbox,
        count: tickets.filter((t) => t.assignedTo === null && isActive(t)).length,
      };
    case 'ADMIN':
      return {
        to: '/viewer-admin/unassigned',
        label: 'Unassigned tickets',
        icon: Inbox,
        count: tickets.filter((t) => t.assignedTo === null && isActive(t)).length,
      };
    case 'SUB_ADMIN':
      return {
        to: '/sub-admin/tickets?status=OPEN',
        label: 'New tickets awaiting acceptance',
        icon: ListChecks,
        count: tickets.filter((t) => t.status === 'OPEN').length,
      };
    case 'LAB_ASSISTANT':
      return {
        to: '/app/tickets?status=RESOLVED',
        label: 'Resolutions awaiting your confirmation',
        icon: ClipboardCheck,
        count: tickets.filter((t) => t.status === 'RESOLVED').length,
      };
  }
}

export default function AppLayout({ role }: { role: Role }) {
  const { user } = useSession();
  if (!user) return <Navigate to="/login" replace />;
  if (user.passwordChangeRequired) return <Navigate to="/change-password" replace />;
  if (user.role !== role) return <Navigate to={roleHome[user.role]} replace />;
  return <Shell user={user} />;
}

function Shell({ user }: { user: User }) {
  const { pathname } = useLocation();
  const [pinned, setPinned] = useState(readPinned);
  const [mobileOpen, setMobileOpen] = useState(false);
  const tickets = useVisibleTickets(user);
  const nav = navByRole[user.role];
  const quick = quickLinkFor(user, tickets);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  useEdgeSwipe({ open: mobileOpen, onOpen: openMobile, onClose: closeMobile });

  const togglePin = () => {
    setPinned((p) => {
      try {
        localStorage.setItem(PIN_KEY, p ? '0' : '1');
      } catch {
        /* storage unavailable: preference just won't persist */
      }
      return !p;
    });
  };

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  const title = useMemo(() => {
    const item = nav.flatMap((g) => g.items).find((i) => i.path === pathname);
    if (item) return item.label;
    if (pathname.includes('/tickets/')) return 'Ticket details';
    if (pathname.endsWith('/new')) return 'Raise Complaint';
    return 'Dashboard';
  }, [nav, pathname]);

  const badgePath = quick.to.split('?')[0]!;
  const sidebarBadges = nav.flatMap((g) => g.items).some((i) => i.path === badgePath)
    ? { [badgePath]: quick.count }
    : {};

  return (
    <div className={`shell ${pinned ? 'shell--pinned' : ''}`}>
      <div className="shell__ambient" aria-hidden="true" />
      <Sidebar
        nav={nav}
        badges={sidebarBadges}
        pinned={pinned}
        onTogglePin={togglePin}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
      />
      <div className="shell__main">
        <Header title={title} onOpenMenu={openMobile} menuOpen={mobileOpen} quickLink={quick} />
        <main className="shell__content" key={pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
