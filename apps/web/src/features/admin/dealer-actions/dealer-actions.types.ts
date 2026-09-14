import type { ActionResult } from '@/types';

export type RunAction = (
  work: () => Promise<ActionResult>,
  success: string,
  destination?: string,
) => void;

export interface ActionBlockProps {
  pending: boolean;
  run: RunAction;
}
