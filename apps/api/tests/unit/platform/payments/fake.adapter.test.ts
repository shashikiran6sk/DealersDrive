import { describe, expect, it } from 'vitest';

import {
  createDisabledPaymentGateway,
  createFakePaymentGateway,
} from '../../../../src/platform/payments/fake.adapter.js';

describe('the fake gateway', () => {
  it('simulates a checkout whose signature its own verifier accepts', async () => {
    const gateway = createFakePaymentGateway();
    const { gatewayOrderId } = await gateway.createOrder({
      amountPaise: 1,
      receipt: 'r',
      notes: {},
    });
    const simulated = gateway.simulate(gatewayOrderId);

    expect(simulated).not.toBeNull();
    expect(
      gateway.verifyCheckout({ gatewayOrderId, ...simulated!, paymentId: simulated!.paymentId }),
    ).toBe(true);
    expect(
      gateway.verifyCheckout({
        gatewayOrderId: 'order_other',
        paymentId: simulated!.paymentId,
        signature: simulated!.signature,
      }),
    ).toBe(false);
  });

  it('is a gateway that sells nothing when none is configured', async () => {
    const none = createDisabledPaymentGateway();
    expect(none.driver).toBe('none');
    expect(none.simulate('order_1')).toBeNull();
    await expect(none.createOrder({ amountPaise: 1, receipt: 'r', notes: {} })).rejects.toThrow();
  });
});
