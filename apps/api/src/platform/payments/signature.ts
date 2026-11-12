import { createHmac, timingSafeEqual } from 'node:crypto';

export function hmacHex(secret: string, payload: string | Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function sameHex(expected: string, received: string): boolean {
  if (!/^[a-f0-9]+$/i.test(received) || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

export function checkoutPayload(gatewayOrderId: string, paymentId: string): string {
  return `${gatewayOrderId}|${paymentId}`;
}
