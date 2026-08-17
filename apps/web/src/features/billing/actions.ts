'use server';

import type { CreateOrderResponse, VerifyOrderResponse } from '@dealers-drive/contracts';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

export interface BuyCreditsResult {
  ok: boolean;
  message: string;
  creditsAdded?: number;
  creditBalance?: number;
  invoiceNumber?: string;
}

/**
 * The buy-credits flow, against whichever payment provider the API has active.
 *
 * The client sends a `packId` and nothing else — never an amount. The server
 * prices the pack; a client that could name its own price could buy 100 credits
 * for ₹1 (ARCHITECTURE §26.4, API-SPEC C19).
 *
 * Locally the provider is `DevelopmentPaymentProvider`, which settles the order
 * inline and reports `autoCaptured`, so there is no checkout page to visit. The
 * shape of this function does not change when Razorpay is switched on: the
 * order is still created here, and `verify` still only *reports* state — the
 * webhook remains the only thing that writes credits.
 */
export async function buyCreditsAction(packId: string): Promise<BuyCreditsResult> {
  try {
    const order = await apiSend<CreateOrderResponse>(
      'POST',
      '/v1/dealer/billing/orders',
      { packId },
      // Required by C19. A retried click must not become a second charge.
      { headers: { 'Idempotency-Key': randomUUID() } },
    );

    if (!order.autoCaptured) {
      // A real gateway would take over here: this is where Checkout opens.
      return {
        ok: false,
        message: 'This environment needs a payment gateway to complete the purchase.',
      };
    }

    const verified = await apiSend<VerifyOrderResponse>(
      'POST',
      `/v1/dealer/billing/orders/${order.orderId}/verify`,
      {},
    );

    // The balance is on the sidebar card, the top bar and the dashboard too.
    revalidatePath('/dealer', 'layout');

    return {
      ok: verified.orderStatus === 'PAID',
      message: verified.message,
      creditsAdded: verified.creditsAdded,
      creditBalance: verified.creditBalance,
      ...(verified.invoice ? { invoiceNumber: verified.invoice.number } : {}),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.problem.detail ?? error.problem.title };
    }
    return { ok: false, message: 'We could not complete that purchase. Try again.' };
  }
}
