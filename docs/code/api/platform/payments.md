# api / platform/payments

Parent: [api](../README.md)

The payment gateway port (**F052**). No SDK: Razorpay's Orders and Payments REST
API plus `node:crypto` HMACs are the whole integration, so there is no new
dependency.

## `apps/api/src/platform/payments/factory.ts`

`PAYMENTS_DRIVER` chooses `razorpay`, `fake` or `none`. It defaults to `none` in
production, so deploying the code without keys changes nothing: packs list,
purchase answers `503 PAYMENTS_DISABLED`. `env.ts` refuses `fake` in production
and requires all three Razorpay values with `razorpay`.

## `apps/api/src/platform/payments/razorpay.adapter.ts`

### `async confirmPayment(paymentId, amountPaise)`

Reads the payment and captures it if it is only `authorized`. Capturing here, as
well as relying on the dashboard's auto-capture setting, means a misconfigured
account cannot leave a dealer's money authorized and then refunded after five days.

### outages

Every network failure or non-2xx is a `503 PAYMENTS_UNAVAILABLE` whose message
says nothing was charged — true for order creation, and for verify the webhook
completes the job later.

## `apps/api/src/platform/payments/signature.ts`

Comparisons are `timingSafeEqual` over decoded hex, after a length check.
