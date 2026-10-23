import type { CSSProperties, ReactNode } from 'react';

export interface BarItem {
  key: string;
  label: ReactNode;
  /** Plain-text name for the tooltip and screen readers. */
  name: string;
  value: number;
}

interface Props {
  items: BarItem[];
  unit?: string;
  wide?: boolean;
}

/** Single-hue horizontal bars for magnitude; hover or focus a row for the exact value and share. */
export default function BarList({ items, unit = 'tickets', wide = false }: Props) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((sum, i) => sum + i.value, 0);

  return (
    <ul className={`bars ${wide ? 'bars--wide' : ''}`}>
      {items.map((item, i) => (
        <li key={item.key} className="bars__row">
          <span className={`bars__label ${typeof item.label === 'string' ? 'bars__label--text' : ''}`}>{item.label}</span>
          <span
            className="bars__track"
            tabIndex={0}
            aria-label={`${item.name}: ${item.value} ${unit}`}
            style={{ '--w': `${(item.value / max) * 100}%`, '--i': i } as CSSProperties}
          >
            <span className="bars__fill" />
            <span className="bars__tip" aria-hidden="true">
              <strong>{item.name}</strong>
              {item.value} {unit}
              {total > 0 ? ` · ${Math.round((item.value / total) * 100)}%` : ''}
            </span>
          </span>
          <span className="bars__value">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
