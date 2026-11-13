export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
  theme: { color: string };
  handler: (response: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
}

export interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: () => void): void;
}

export type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}
