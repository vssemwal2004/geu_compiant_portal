import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

/** Small confirmation message after an action. Returns [element, show]. */
export function useToast(duration = 2800) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), duration);
    return () => clearTimeout(id);
  }, [message, duration]);

  const show = useCallback((text: string) => setMessage(text), []);

  const node = message ? (
    <div className="toast" role="status" key={message}>
      <CheckCircle2 size={18} aria-hidden="true" />
      {message}
    </div>
  ) : null;

  return [node, show] as const;
}
