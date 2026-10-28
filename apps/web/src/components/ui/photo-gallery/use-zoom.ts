import { useCallback, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

import { ZOOM } from './photo-gallery.constants';
import type { FrameRect, Point, Tap, ZoomAction, ZoomView } from './photo-gallery.types';
import {
  UNZOOMED,
  distance,
  framePoint,
  isDoubleTap,
  isTap,
  isZoomed,
  panView,
  pinchView,
  settleView,
  stepView,
  toggleView,
  wheelScale,
  zoomAt,
} from './utils';

export interface ZoomHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}

export interface Zoom {
  frameRef: (node: HTMLDivElement | null) => (() => void) | undefined;
  view: ZoomView;
  zoomed: boolean;
  smooth: boolean;
  handlers: ZoomHandlers;
  act: (action: ZoomAction) => void;
  pan: (delta: Point) => void;
}

type ViewChange = (current: ZoomView, frame: FrameRect) => ZoomView;

function clientPoint(event: { clientX: number; clientY: number }): Point {
  return { x: event.clientX, y: event.clientY };
}

export function useZoom(resetKey: string): Zoom {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const pressRef = useRef<Tap | null>(null);
  const lastTapRef = useRef<Tap | null>(null);
  const [view, setView] = useState<ZoomView>(UNZOOMED);
  const [smooth, setSmooth] = useState(false);
  const [shownKey, setShownKey] = useState(resetKey);

  if (shownKey !== resetKey) {
    setShownKey(resetKey);
    setSmooth(false);
    setView(UNZOOMED);
  }

  const update = useCallback((change: ViewChange, animate: boolean) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    setSmooth(animate);
    setView((current) => change(current, rect));
  }, []);

  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      frameRef.current = node;
      if (!node) return undefined;
      function onWheel(event: WheelEvent) {
        event.preventDefault();
        const client = clientPoint(event);
        update(
          (current, frame) =>
            zoomAt(current, wheelScale(current.scale, event), framePoint(client, frame), frame),
          false,
        );
      }
      node.addEventListener('wheel', onWheel, { passive: false });
      return () => {
        node.removeEventListener('wheel', onWheel);
        frameRef.current = null;
      };
    },
    [update],
  );

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const point = clientPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, point);
    pressRef.current = pointersRef.current.size === 1 ? { time: Date.now(), ...point } : null;
    if (event.pointerType === 'mouse') event.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const pointers = pointersRef.current;
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const point = clientPoint(event);
      const others = [...pointers].filter(([id]) => id !== event.pointerId).map(([, at]) => at);
      pointers.set(event.pointerId, point);
      const press = pressRef.current;
      if (press && distance(press, point) > ZOOM.tapSlopPx) pressRef.current = null;
      const [other] = others;
      if (others.length === 0) {
        const delta = { x: point.x - previous.x, y: point.y - previous.y };
        update((current, frame) => panView(current, delta, frame), false);
      } else if (others.length === 1 && other) {
        update(
          (current, frame) => pinchView(current, [previous, other], [point, other], frame),
          false,
        );
      }
    },
    [update],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const pointers = pointersRef.current;
      if (!pointers.delete(event.pointerId)) return;
      const press = pressRef.current;
      pressRef.current = null;
      if (pointers.size > 0) return;
      const tap = { time: Date.now(), ...clientPoint(event) };
      if (press && isTap(press, tap)) {
        const last = lastTapRef.current;
        if (last && isDoubleTap(last, tap)) {
          lastTapRef.current = null;
          update((current, frame) => toggleView(current, framePoint(tap, frame), frame), true);
          return;
        }
        lastTapRef.current = tap;
      }
      update(settleView, true);
    },
    [update],
  );

  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const pointers = pointersRef.current;
      if (!pointers.delete(event.pointerId)) return;
      pressRef.current = null;
      if (pointers.size === 0) update(settleView, true);
    },
    [update],
  );

  const act = useCallback(
    (action: ZoomAction) => update((current, frame) => stepView(current, action, frame), true),
    [update],
  );

  const pan = useCallback(
    (delta: Point) => update((current, frame) => panView(current, delta, frame), true),
    [update],
  );

  return {
    frameRef: attach,
    view,
    zoomed: isZoomed(view),
    smooth,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    act,
    pan,
  };
}
