export type PaymentDriver = 'none' | 'fake' | 'razorpay';

export interface GatewayOrderInput {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}

export interface ConfirmedPayment {
  captured: boolean;
  gatewayOrderId: string | null;
  amountPaise: number;
  status: string;
}

export interface CheckoutSignature {
  gatewayOrderId: string;
  paymentId: string;
  signature: string;
}

export interface PaymentGatewayPort {
  readonly driver: PaymentDriver;
  readonly keyId: string | null;
  createOrder(input: GatewayOrderInput): Promise<{ gatewayOrderId: string }>;
  verifyCheckout(input: CheckoutSignature): boolean;
  confirmPayment(paymentId: string, amountPaise: number): Promise<ConfirmedPayment>;
  verifyWebhook(rawBody: Buffer, signature: string): boolean;
  simulate(gatewayOrderId: string): { paymentId: string; signature: string } | null;
}
