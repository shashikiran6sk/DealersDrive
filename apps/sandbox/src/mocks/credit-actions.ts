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

export async function recheckCreditOrderAction(
  _dealerId: string,
  orderId: string,
): Promise<ActionResult> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return orderId.startsWith('2d9c')
    ? { ok: true, message: 'Razorpay confirmed the payment. The credits have been added.' }
    : { ok: true, message: 'Razorpay has no completed payment for this order. Nothing changed.' };
}
