import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface Props {
  title: string;
  icon: LucideIcon;
}

// Shown for admin sections whose screens are built in later steps.
export default function PlaceholderPage({ title, icon: Icon }: Props) {
  return (
    <section
      className="glass rise-in"
      style={{
        display: 'grid',
        placeItems: 'center',
        gap: 14,
        padding: '64px 24px',
        borderRadius: 'var(--radius-xl)',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 64,
          height: 64,
          borderRadius: 18,
          background: 'var(--gold-100)',
          color: 'var(--navy-900)',
        }}
      >
        <Icon size={28} />
      </span>
      <h2 style={{ fontWeight: 800, color: 'var(--navy-900)' }}>{title}</h2>
      <p style={{ maxWidth: 420, color: 'var(--ink-500)', fontWeight: 300 }}>
        This screen is planned for the next build step.
      </p>
      <Link to="/admin" className="btn btn-ghost">
        <ArrowLeft size={16} /> Back to dashboard
      </Link>
    </section>
  );
}
