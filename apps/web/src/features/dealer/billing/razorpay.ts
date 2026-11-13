import type { CreditCheckout, VerifyCreditOrderInput } from '@dealers-drive/contracts';

import { CHECKOUT_THEME_COLOR, RAZORPAY_CHECKOUT_SRC, BILLING_TEXT } from './billing.constants';
import type { RazorpayConstructor } from './razorpay.types';

let loading: Promise<RazorpayConstructor> | null = null;

export function loadRazorpay(): Promise<RazorpayConstructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error(BILLING_TEXT.scriptFailed));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error(BILLING_TEXT.scriptFailed));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type CheckoutOutcome =
  { kind: 'paid'; payment: VerifyCreditOrderInput } | { kind: 'dismissed' } | { kind: 'failed' };

export async function openCheckout(checkout: CreditCheckout): Promise<CheckoutOutcome> {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    const instance = new Razorpay({
      key: checkout.keyId,
      order_id: checkout.gatewayOrderId,
      amount: checkout.totalPaise,
      currency: checkout.currency,
      name: BILLING_TEXT.merchant,
      description: checkout.description,
      prefill: {
        ...(checkout.prefill.name ? { name: checkout.prefill.name } : {}),
        ...(checkout.prefill.email ? { email: checkout.prefill.email } : {}),
        ...(checkout.prefill.contact ? { contact: checkout.prefill.contact } : {}),
      },
      theme: { color: CHECKOUT_THEME_COLOR },
      handler: (response) =>
        resolve({
          kind: 'paid',
          payment: {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          },
        }),
      modal: { ondismiss: () => resolve({ kind: 'dismissed' }) },
    });
    instance.on('payment.failed', () => resolve({ kind: 'failed' }));
    instance.open();
  });
}
