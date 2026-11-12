import type { ActionResult } from '@/types';

export async function adjustDealerCreditsAction(
  _dealerId: string,
  credits: number,
  note: string,
): Promise<ActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  if (!Number.isInteger(credits) || credits === 0 || note.trim().length < 3) {
    return { ok: false, message: 'Enter a whole number of credits other than 0, and a note.' };
  }
  return { ok: true, message: 'Credits updated.' };
}
