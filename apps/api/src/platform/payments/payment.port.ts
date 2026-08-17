/**
 * PaymentProvider
 *   ├── DevelopmentPaymentProvider   ← active now (CLAUDE.md §18)
 *   └── RazorpayProvider             ← drops in behind the same interface
 *
 * The shape of this port is dictated by what Razorpay will need, not by what
 * the development provider needs, so adding the real gateway later is wiring
 * rather than a redesign:
 *
 *   - the amount is always computed server-side from a `CreditPack` and passed
 *     in, never accepted from a client (§26.4);
 *   - `createOrder` returns a gateway order id, which is what Checkout opens;
 *   - `settlement` describes how credits eventually land. The development
 *     provider reports `immediate`, meaning the caller settles inline through
 *     exactly the same code path a `payment.captured` webhook would run.
 *     Razorpay reports `webhook`, and the caller does nothing but wait.
 *
 * The last point is the important one: there is one `settlePayment` service,
 * and both providers reach it. Swapping providers cannot change how a credit
 * is written.
 */
export interface GatewayOrder {
  gatewayOrderId: string;
  /** `immediate` settles inline; `webhook` waits for the gateway to call back. */
  settlement: 'immediate' | 'webhook';
  /** Present only when `settlement` is `immediate`. */
  capture?: GatewayCapture;
}

export interface GatewayCapture {
  gatewayPaymentId: string;
  method: string;
  amountPaise: bigint;
  rawPayload: Record<string, unknown>;
}

export interface CreateOrderRequest {
  orderId: string;
  dealerId: string;
  credits: number;
  totalPaise: bigint;
  currency: string;
  notes: Record<string, string>;
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(request: CreateOrderRequest): Promise<GatewayOrder>;
  /**
   * Confirms what the browser reports. It never credits — it reads and
   * reports, because the browser can be closed, throttled, or lying (§26.4).
   */
  verifyClientHandshake(input: {
    gatewayOrderId: string;
    paymentId?: string;
    signature?: string;
  }): boolean;
}
