import { isRecord } from '../errors.js';
import { UpstreamUnavailableError } from '../errors.js';
import { logger } from '../telemetry/logger.js';

import type { ConfirmedPayment, PaymentGatewayPort } from './payment.port.js';
import { checkoutPayload, hmacHex, sameHex } from './signature.js';

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  apiBase: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export const RAZORPAY_UNAVAILABLE =
  'The payment service did not answer. Nothing was charged — try again in a moment.';

function text(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === 'string' ? field : null;
}

function amount(value: unknown): number {
  if (!isRecord(value)) return 0;
  return typeof value.amount === 'number' ? value.amount : 0;
}

export function createRazorpayGateway(credentials: RazorpayCredentials): PaymentGatewayPort {
  const send = credentials.fetch ?? fetch;
  const authorization = `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`;

  async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await send(`${credentials.apiBase}${path}`, {
        method,
        headers: {
          Authorization: authorization,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(credentials.timeoutMs ?? 10_000),
      });
    } catch (cause) {
      logger.error({ err: cause, path }, 'razorpay.unreachable');
      throw new UpstreamUnavailableError(RAZORPAY_UNAVAILABLE, {
        cause,
        code: 'PAYMENTS_UNAVAILABLE',
      });
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = isRecord(payload) ? payload.error : null;
      logger.error(
        {
          status: response.status,
          path,
          code: text(error, 'code'),
          reason: text(error, 'description'),
        },
        'razorpay.refused',
      );
      throw new UpstreamUnavailableError(RAZORPAY_UNAVAILABLE, { code: 'PAYMENTS_UNAVAILABLE' });
    }
    return payload;
  }

  function confirmed(payment: unknown): ConfirmedPayment {
    const status = text(payment, 'status') ?? 'unknown';
    return {
      captured: status === 'captured',
      gatewayOrderId: text(payment, 'order_id'),
      amountPaise: amount(payment),
      status,
    };
  }

  return {
    driver: 'razorpay',
    keyId: credentials.keyId,

    async createOrder({ amountPaise, receipt, notes }) {
      const order = await call('POST', '/v1/orders', {
        amount: amountPaise,
        currency: 'INR',
        receipt,
        notes,
      });
      const id = text(order, 'id');
      if (!id)
        throw new UpstreamUnavailableError(RAZORPAY_UNAVAILABLE, { code: 'PAYMENTS_UNAVAILABLE' });
      return { gatewayOrderId: id };
    },

    verifyCheckout({ gatewayOrderId, paymentId, signature }) {
      return sameHex(
        hmacHex(credentials.keySecret, checkoutPayload(gatewayOrderId, paymentId)),
        signature,
      );
    },

    async confirmPayment(paymentId, amountPaise) {
      const path = `/v1/payments/${encodeURIComponent(paymentId)}`;
      const payment = confirmed(await call('GET', path));
      if (payment.status !== 'authorized') return payment;
      return confirmed(
        await call('POST', `${path}/capture`, { amount: amountPaise, currency: 'INR' }),
      );
    },

    verifyWebhook(rawBody, signature) {
      return sameHex(hmacHex(credentials.webhookSecret, rawBody), signature);
    },

    simulate: () => null,
  };
}
