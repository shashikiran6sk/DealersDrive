'use client';

import type { StorefrontEnquiryContext } from '@dealers-drive/contracts';
import { useActionState, useId } from 'react';

import { Button } from '@/components/ui/button';
import type { EnquiryCustomer } from '@/features/enquiry/actions';
import { sendWebsiteEnquiryAction, type WebsiteEnquiryState } from '../actions';

export function WebsiteEnquiry({
  ticket,
  context,
  customer,
}: {
  ticket: string;
  context: StorefrontEnquiryContext;
  customer: EnquiryCustomer;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(sendWebsiteEnquiryAction.bind(null, ticket), {
    status: 'idle',
  } satisfies WebsiteEnquiryState);
  if (state.status === 'sent')
    return (
      <div role="status" className="card gap-4 p-6">
        <h2 className="text-[24px]">Your enquiry has been sent</h2>
        <p>
          {context.dealerName} received your verified contact details and will handle your enquiry.
        </p>
        <a href={context.returnUrl} className="underline underline-offset-4">
          Return to the car
        </a>
      </div>
    );
  return (
    <form action={action} className="card gap-5 p-6" aria-label="Website vehicle enquiry">
      <div>
        <h2 className="text-[24px] tracking-tight">Send your enquiry</h2>
        <p className="mt-2 text-[14px] ink-muted">{context.vehicleTitle}</p>
      </div>
      <dl className="grid gap-3 text-[14px]">
        <div>
          <dt className="text-[12px] ink-muted">Your name</dt>
          <dd>{customer.fullName}</dd>
        </div>
        <div>
          <dt className="text-[12px] ink-muted">Verified mobile number</dt>
          <dd>{customer.phoneDisplay}</dd>
        </div>
      </dl>
      <div className="field">
        <label htmlFor={`${id}-message`}>
          Message <span className="ink-muted">(optional)</span>
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          className="input min-h-[100px] py-3"
          maxLength={1000}
          placeholder="Tell the dealership what you would like to know."
        />
      </div>
      <label
        className="flex items-start gap-3 text-[13px] leading-relaxed"
        htmlFor={`${id}-consent`}
      >
        <input
          id={`${id}-consent`}
          type="checkbox"
          name="consent"
          required
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>
          I agree to share my account name, verified mobile number and message with{' '}
          {context.dealerName} and Dealers-Drive to handle this enquiry.{' '}
          <a
            href={new URL('/privacy', context.returnUrl).toString()}
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy information
          </a>
          .
        </span>
      </label>
      {state.status === 'error' ? (
        <p role="alert" className="text-[13px] text-(--color-err)">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" loading={pending} disabled={pending} className="min-h-[48px]">
        Send to {context.dealerName}
      </Button>
      <a href={context.returnUrl} className="text-[13px] underline underline-offset-4">
        Return to the dealership website
      </a>
    </form>
  );
}
