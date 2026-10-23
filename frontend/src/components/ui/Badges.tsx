import {
  ArrowDown,
  ArrowUp,
  Ban,
  CheckCircle2,
  CircleDot,
  Clock3,
  Equal,
  Lock,
  RotateCcw,
  Siren,
  type LucideIcon,
} from 'lucide-react';
import type { TicketPriority, TicketStatus } from '../../domain/types';
import './Badges.css';

const statusMeta: Record<TicketStatus, { label: string; icon: LucideIcon; tone: string }> = {
  OPEN: { label: 'Open', icon: CircleDot, tone: 'open' },
  IN_PROGRESS: { label: 'In progress', icon: Clock3, tone: 'progress' },
  RESOLVED: { label: 'Resolved', icon: CheckCircle2, tone: 'resolved' },
  REOPENED: { label: 'Reopened', icon: RotateCcw, tone: 'reopened' },
  CLOSED: { label: 'Closed', icon: Lock, tone: 'closed' },
  CANCELLED: { label: 'Cancelled', icon: Ban, tone: 'closed' },
};

const priorityMeta: Record<TicketPriority, { label: string; icon: LucideIcon; tone: string }> = {
  LOW: { label: 'Low', icon: ArrowDown, tone: 'low' },
  MEDIUM: { label: 'Medium', icon: Equal, tone: 'medium' },
  HIGH: { label: 'High', icon: ArrowUp, tone: 'high' },
  CRITICAL: { label: 'Critical', icon: Siren, tone: 'critical' },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { label, icon: Icon, tone } = statusMeta[status];
  return (
    <span className={`badge badge--${tone}`}>
      <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const { label, icon: Icon, tone } = priorityMeta[priority];
  return (
    <span className={`prio prio--${tone}`}>
      <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
      {label}
    </span>
  );
}

export { priorityMeta, statusMeta };
