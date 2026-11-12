import type {
  CreditCheckout,
  CreditOrderResult,
  VerifyCreditOrderInput,
} from '@dealers-drive/contracts';

export type ActionOutcome<T> = { ok: true; value: T } | { ok: false; message: string };

const ORDER_ID = '0b7a4f0e-6a39-4b8a-9d55-2f1c3b8e7a10';

export const billingActionStub: { delayMs: number; fail: boolean } = { delayMs: 600, fail: false };

const wait = () => new Promise((resolve) => setTimeout(resolve, billingActionStub.delayMs));

export async function createCreditOrderAction(
  packId: string,
): Promise<ActionOutcome<CreditCheckout>> {
  await wait();
  if (billingActionStub.fail) return { ok: false, message: 'The payment service did not answer.' };
  const credits = Number(packId.replace('pack-', '')) || 1;
  return {
    ok: true,
    value: {
      orderId: ORDER_ID,
      gateway: 'fake',
      gatewayOrderId: 'order_fakesandbox',
      keyId: 'rzp_test_fake',
      credits,
      amountPaise: credits * 50_000,
      taxPaise: credits * 9_000,
      totalPaise: credits * 59_000,
      totalLabel: `₹${(credits * 590).toLocaleString('en-IN')}`,
      currency: 'INR',
      description: `${String(credits)} credits for Dealers-Drive listings`,
      prefill: { name: 'Sri Lakshmi Motors', email: null, contact: null },
      simulation: { paymentId: 'pay_fakesandbox', signature: 'a'.repeat(64) },
    },
  };
}

export async function verifyCreditOrderAction(
  _orderId: string,
  _payment: VerifyCreditOrderInput,
): Promise<ActionOutcome<CreditOrderResult>> {
  await wait();
  return {
    ok: true,
    value: {
      orderId: ORDER_ID,
      status: 'PAID',
      credits: 5,
      balance: 5,
      available: 5,
      message: '5 credits added — payment received. Thank you.',
    },
  };
}
