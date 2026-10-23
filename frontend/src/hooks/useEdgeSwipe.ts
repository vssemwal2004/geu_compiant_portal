import { useEffect } from 'react';

interface Options {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Width (px) of the left-edge zone where an opening swipe may start. */
  edge?: number;
  /** Minimum horizontal travel (px) to count as a swipe. */
  threshold?: number;
}

/**
 * Touch gesture for the mobile drawer:
 * swipe right from the left edge to open, swipe left anywhere to close.
 * Vertical scrolls are ignored so the page still scrolls normally.
 */
export function useEdgeSwipe({ open, onOpen, onClose, edge = 28, threshold = 60 }: Options) {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    function onStart(e: TouchEvent) {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      tracking = open || startX <= edge;
    }

    function onEnd(e: TouchEvent) {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (!open && dx > 0) onOpen();
      if (open && dx < 0) onClose();
    }

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [open, onOpen, onClose, edge, threshold]);
}
