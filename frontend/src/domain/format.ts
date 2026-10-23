import { users } from '../data/mockData';

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} d ago`;
  return formatDate(iso);
}

/** "in 3 h" / "5 h overdue" */
export function dueLabel(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const h = Math.round(Math.abs(diff) / 3_600_000);
  const span = h < 1 ? '< 1 h' : h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
  return diff >= 0 ? `due in ${span}` : `${span} overdue`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function userName(id: string | null | undefined): string {
  if (!id) return 'System';
  return users.find((u) => u.id === id)?.name ?? 'Unknown user';
}

export function initials(name: string) {
  return name
    .replace(/[^A-Za-z ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** "+91 90000 00001" → "+91 ••••• •0001" */
export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `+${digits.slice(0, 2)} ••••• •${digits.slice(-4)}`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
