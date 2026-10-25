import {
  RAIL_NUMBER_DIGITS,
  STUDIO_BACKDROP,
  SWIPE_THRESHOLD_PX,
  ZOOM,
  ZOOM_IN_KEYS,
  ZOOM_OUT_KEYS,
  ZOOM_RESET_KEY,
} from './photo-gallery.constants';
import type {
  FrameRect,
  GalleryPhoto,
  GalleryStep,
  PhotoKind,
  Point,
  Tap,
  ZoomAction,
  ZoomView,
} from './photo-gallery.types';

export function wrapIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

export function initialIndex(requested: number, total: number): number {
  return Number.isInteger(requested) && requested >= 0 && requested < total ? requested : 0;
}

export function arrowStep(key: string): GalleryStep | null {
  if (key === 'ArrowLeft') return -1;
  if (key === 'ArrowRight') return 1;
  return null;
}

export interface StripMetrics {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

export function stripEdges({ scrollLeft, clientWidth, scrollWidth }: StripMetrics): {
  atStart: boolean;
  atEnd: boolean;
} {
  return {
    atStart: scrollLeft <= 1,
    atEnd: scrollLeft + clientWidth >= scrollWidth - 1,
  };
}

export function railNumber(index: number): string {
  return String(index + 1).padStart(RAIL_NUMBER_DIGITS, '0');
}

export interface Span {
  left: number;
  right: number;
}

export function revealOffset(track: Span, thumb: Span): number {
  if (thumb.left < track.left) return thumb.left - track.left;
  if (thumb.right > track.right) return thumb.right - track.right;
  return 0;
}

export function swipeStep(
  deltaX: number,
  deltaY: number,
  threshold: number = SWIPE_THRESHOLD_PX,
): GalleryStep | null {
  if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) return null;
  return deltaX < 0 ? 1 : -1;
}

export function captionOf(photo: GalleryPhoto): string {
  return photo.caption?.trim() || photo.alt;
}

const CHANNEL_MAX = 255;

export function studioWhiteLevel(level: number): number {
  const { level: backdrop, knee } = STUDIO_BACKDROP;
  if (level <= knee) return level;
  if (level >= backdrop) return CHANNEL_MAX;
  return knee + ((level - knee) * (CHANNEL_MAX - knee)) / (backdrop - knee);
}

export function studioWhiteTable(): string {
  const { tableStep } = STUDIO_BACKDROP;
  const values: string[] = [];
  for (let level = 0; level <= CHANNEL_MAX; level += tableStep) {
    values.push(String(Number((studioWhiteLevel(level) / CHANNEL_MAX).toFixed(4))));
  }
  return values.join(' ');
}

export function isStudioBackdrop(rgba: ArrayLike<number>): boolean {
  const { level, tolerance } = STUDIO_BACKDROP;
  for (let offset = 0; offset + 2 < rgba.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = rgba[offset + channel];
      if (value === undefined || Math.abs(value - level) > tolerance) return false;
    }
  }
  return rgba.length >= 4;
}

export function cornerKind(rgba: ArrayLike<number>, edge: number): PhotoKind {
  const last = edge - 1;
  const corners = [0, last, last * edge, last * edge + last].flatMap((pixel) =>
    Array.from({ length: 4 }, (_, channel) => rgba[pixel * 4 + channel] ?? -1),
  );
  return isStudioBackdrop(corners) ? 'studio' : 'photo';
}

export function studioFilterId(reactId: string): string {
  return `${STUDIO_BACKDROP.filterIdPrefix}${reactId.replace(/[^A-Za-z0-9_-]/g, '')}`;
}

export const UNZOOMED: ZoomView = Object.freeze({ scale: ZOOM.min, x: 0, y: 0 });

export function isZoomed(view: ZoomView): boolean {
  return view.scale > ZOOM.min;
}

export function clampScale(scale: number): number {
  return Math.min(ZOOM.max, Math.max(ZOOM.min, scale));
}

function clampMagnitude(value: number, limit: number): number {
  return Math.min(limit, Math.max(-limit, value));
}

export function clampView(view: ZoomView, frame: FrameRect): ZoomView {
  const scale = clampScale(view.scale);
  if (scale <= ZOOM.min) return UNZOOMED;
  return {
    scale,
    x: clampMagnitude(view.x, ((scale - 1) * frame.width) / 2),
    y: clampMagnitude(view.y, ((scale - 1) * frame.height) / 2),
  };
}

export function zoomAt(view: ZoomView, scale: number, point: Point, frame: FrameRect): ZoomView {
  const next = clampScale(scale);
  const ratio = next / view.scale;
  return clampView(
    {
      scale: next,
      x: point.x - ratio * (point.x - view.x),
      y: point.y - ratio * (point.y - view.y),
    },
    frame,
  );
}

export function panView(view: ZoomView, delta: Point, frame: FrameRect): ZoomView {
  return clampView({ ...view, x: view.x + delta.x, y: view.y + delta.y }, frame);
}

export function settleView(view: ZoomView): ZoomView {
  return view.scale < ZOOM.settleBelow ? UNZOOMED : view;
}

export function stepView(view: ZoomView, action: ZoomAction, frame: FrameRect): ZoomView {
  const centre = { x: 0, y: 0 };
  if (action === 'in') return zoomAt(view, view.scale * ZOOM.step, centre, frame);
  if (action === 'out') return settleView(zoomAt(view, view.scale / ZOOM.step, centre, frame));
  return UNZOOMED;
}

export function toggleView(view: ZoomView, point: Point, frame: FrameRect): ZoomView {
  return isZoomed(view) ? UNZOOMED : zoomAt(view, ZOOM.doubleTap, point, frame);
}

export function framePoint(client: Point, frame: FrameRect): Point {
  return { x: client.x - frame.left - frame.width / 2, y: client.y - frame.top - frame.height / 2 };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function pinchView(
  view: ZoomView,
  before: readonly [Point, Point],
  after: readonly [Point, Point],
  frame: FrameRect,
): ZoomView {
  const spread = distance(...before);
  if (spread === 0) return view;
  const from = midpoint(...before);
  const to = midpoint(...after);
  const scaled = zoomAt(
    view,
    (view.scale * distance(...after)) / spread,
    framePoint(from, frame),
    frame,
  );
  return panView(scaled, { x: to.x - from.x, y: to.y - from.y }, frame);
}

export interface WheelInput {
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
}

export function wheelScale(scale: number, { deltaY, deltaMode, ctrlKey }: WheelInput): number {
  const unit = deltaMode === 1 ? ZOOM.wheelLinePx : deltaMode === 2 ? ZOOM.wheelPagePx : 1;
  const sensitivity = ctrlKey ? ZOOM.pinchWheelSensitivity : ZOOM.wheelSensitivity;
  return scale * Math.exp(-deltaY * unit * sensitivity);
}

export function zoomKey(key: string): ZoomAction | null {
  if (ZOOM_IN_KEYS.includes(key)) return 'in';
  if (ZOOM_OUT_KEYS.includes(key)) return 'out';
  if (key === ZOOM_RESET_KEY) return 'reset';
  return null;
}

export function hasModifier(event: {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}

export function arrowPan(key: string, step: number = ZOOM.keyPanPx): Point | null {
  if (key === 'ArrowLeft') return { x: step, y: 0 };
  if (key === 'ArrowRight') return { x: -step, y: 0 };
  if (key === 'ArrowUp') return { x: 0, y: step };
  if (key === 'ArrowDown') return { x: 0, y: -step };
  return null;
}

export function isTap(start: Tap, end: Tap): boolean {
  return (
    end.time - start.time <= ZOOM.tapMs &&
    Math.hypot(end.x - start.x, end.y - start.y) <= ZOOM.tapSlopPx
  );
}

export function isDoubleTap(previous: Tap, current: Tap): boolean {
  return (
    current.time - previous.time <= ZOOM.doubleTapMs &&
    Math.hypot(current.x - previous.x, current.y - previous.y) <= ZOOM.doubleTapSlopPx
  );
}

export function zoomTransform({ scale, x, y }: ZoomView): string {
  return `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}
