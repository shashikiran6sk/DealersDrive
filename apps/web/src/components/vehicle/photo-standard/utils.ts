import type { Point } from './photo-standard.types';

const CONE_HALF_ANGLE = 0.32;

export function viewCone(from: Point, to: Point, reach = 1): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  const length = Math.hypot(dx, dy) * reach;
  const edge = (offset: number): Point => ({
    x: from.x + Math.cos(angle + offset) * length,
    y: from.y + Math.sin(angle + offset) * length,
  });
  const left = edge(-CONE_HALF_ANGLE);
  const right = edge(CONE_HALF_ANGLE);
  return [from, left, right]
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
}
