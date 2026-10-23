import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import './StatCard.css';

interface Props {
  label: string;
  value: string | number;
  note: string;
  icon: LucideIcon;
  tone?: 'navy' | 'gold' | 'critical' | 'resolved';
  index?: number;
}

export default function StatCard({ label, value, note, icon: Icon, tone = 'navy', index = 0 }: Props) {
  return (
    <article className={`stat glass rise-in stat--${tone}`} style={{ '--i': index } as CSSProperties}>
      <div className="stat__top">
        <span className="stat__label">{label}</span>
        <span className="stat__icon">
          <Icon size={20} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
      <p className="stat__value">{value}</p>
      <p className="stat__note">{note}</p>
    </article>
  );
}
