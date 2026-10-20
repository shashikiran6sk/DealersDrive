import { spacing } from '../../../theme/tokens';

export const INVENTORY_SCROLL_MARGIN = spacing.sm;

export function inventoryOffset(headingY: number): number {
  return Math.max(0, spacing.md + headingY - INVENTORY_SCROLL_MARGIN);
}
