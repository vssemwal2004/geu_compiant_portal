import {
  BarChart3,
  Boxes,
  ClipboardList,
  GitBranch,
  History,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MapPin,
  PlusCircle,
  Settings,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '../domain/types';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Screen not built yet — routed to a placeholder page. */
  placeholder?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

// Navigation per role — mirrors the workflows in the architecture PDF (§4, §8, §10).
export const navByRole: Record<Role, NavGroup[]> = {
  MAIN_ADMIN: [
    {
      title: 'Overview',
      items: [
        { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
        { label: 'All Tickets', path: '/admin/tickets', icon: ClipboardList },
        { label: 'Unassigned Queue', path: '/admin/unassigned', icon: Inbox },
      ],
    },
    {
      title: 'Configuration',
      items: [
        { label: 'Users', path: '/admin/users', icon: Users },
        { label: 'Roles', path: '/admin/roles', icon: UserRound },
        { label: 'Locations', path: '/admin/locations', icon: MapPin },
        { label: 'Asset Types', path: '/admin/asset-types', icon: Boxes },
        { label: 'Routing Rules', path: '/admin/routing-rules', icon: GitBranch },
      ],
    },
    {
      title: 'Insights',
      items: [
        { label: 'Escalations', path: '/admin/escalations', icon: Inbox },
        { label: 'Reports', path: '/admin/reports', icon: BarChart3 },
        { label: 'Audit Log', path: '/admin/audit-log', icon: History },
        { label: 'Settings', path: '/admin/settings', icon: Settings, placeholder: true },
      ],
    },
  ],
  SUB_ADMIN: [
    {
      title: 'Work',
      items: [
        { label: 'Dashboard', path: '/sub-admin', icon: LayoutDashboard },
        { label: 'Assigned Tickets', path: '/sub-admin/tickets', icon: ListChecks },
      ],
    },
    {
      title: 'Account',
      items: [{ label: 'Profile', path: '/sub-admin/profile', icon: UserRound, placeholder: true }],
    },
  ],
  LAB_ASSISTANT: [
    {
      title: 'Complaints',
      items: [
        { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
        { label: 'Raise Complaint', path: '/app/new', icon: PlusCircle },
        { label: 'My Tickets', path: '/app/tickets', icon: ClipboardList },
      ],
    },
    {
      title: 'Account',
      items: [{ label: 'Profile', path: '/app/profile', icon: UserRound, placeholder: true }],
    },
  ],
};
