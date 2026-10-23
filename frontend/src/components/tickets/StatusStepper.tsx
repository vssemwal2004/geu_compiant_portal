import { Ban, Check, RotateCcw } from 'lucide-react';
import type { TicketStatus } from '../../domain/types';
import './StatusStepper.css';

const steps = ['Open', 'In progress', 'Resolved', 'Closed'];

const reached: Record<TicketStatus, number> = {
  OPEN: 0,
  IN_PROGRESS: 1,
  REOPENED: 1, // back to work after a dispute
  RESOLVED: 2,
  CLOSED: 3,
  CANCELLED: -1,
};

/** Progress of a ticket through its lifecycle, shown to the person who raised it. */
export default function StatusStepper({ status, compact = false }: { status: TicketStatus; compact?: boolean }) {
  if (status === 'CANCELLED') {
    return (
      <p className="stepper-cancelled">
        <Ban size={15} aria-hidden="true" /> This ticket was cancelled.
      </p>
    );
  }

  const current = reached[status];
  return (
    <ol className={`stepper ${compact ? 'stepper--compact' : ''}`} aria-label={`Progress: ${steps[current]}`}>
      {steps.map((label, i) => {
        const state = i < current || status === 'CLOSED' ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={label} className={`stepper__step is-${state}`}>
            <span className="stepper__dot">
              {state === 'done' ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
            </span>
            <span className="stepper__label">
              {label}
              {status === 'REOPENED' && i === 1 && (
                <em>
                  <RotateCcw size={11} aria-hidden="true" /> reopened
                </em>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
