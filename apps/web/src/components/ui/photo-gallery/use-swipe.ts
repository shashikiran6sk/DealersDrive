import { useCallback, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

import { SWIPE_CLICK_GUARD_MS } from './photo-gallery.constants';
import type { GalleryStep } from './photo-gallery.types';
import { swipeStep } from './utils';

interface SwipeStart {
  pointerId: number;
  x: number;
  y: number;
}

export interface SwipeHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
}

export function useSwipe(onStep: (delta: GalleryStep) => void, enabled: boolean): SwipeHandlers {
  const startRef = useRef<SwipeStart | null>(null);
  const guardUntilRef = useRef(0);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      guardUntilRef.current = 0;
      if (startRef.current) {
        if (startRef.current.pointerId !== event.pointerId) startRef.current = null;
        return;
      }
      if (!enabled || event.pointerType === 'mouse') return;
      startRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    },
    [enabled],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const start = startRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      startRef.current = null;
      const delta = swipeStep(event.clientX - start.x, event.clientY - start.y);
      if (delta === null) return;
      guardUntilRef.current = Date.now() + SWIPE_CLICK_GUARD_MS;
      onStep(delta);
    },
    [onStep],
  );

  const onPointerCancel = useCallback(() => {
    startRef.current = null;
  }, []);

  const onClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
    if (Date.now() >= guardUntilRef.current) return;
    guardUntilRef.current = 0;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel, onClickCapture };
}
