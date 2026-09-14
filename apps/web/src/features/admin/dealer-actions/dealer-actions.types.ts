import type { ActionResult } from '@/types';

/**
 * Runs one decision: clears the banners, awaits the action, then either shows
 * the failure or the success line. `destination` is for the decision that leaves
 * no page to refresh.
 */
export type RunAction = (
  work: () => Promise<ActionResult>,
  success: string,
  destination?: string,
) => void;

export interface ActionBlockProps {
  pending: boolean;
  run: RunAction;
}
