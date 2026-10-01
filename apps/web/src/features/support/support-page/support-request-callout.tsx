import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';

import { SupportIcon } from './support-icon';
import { SUPPORT_TEXT } from './support-page.constants';

export function SupportRequestCallout() {
  return (
    <section
      aria-labelledby="support-request-heading"
      className="card mt-[28px] flex flex-col gap-[16px] bg-white p-6 md:flex-row md:items-center md:gap-[28px] md:p-8"
    >
      <SupportIcon name="request" />
      <div className="min-w-0 flex-1">
        <h2 id="support-request-heading" className="text-[20px] sm:text-[22px]">
          {SUPPORT_TEXT.requestTitle}
        </h2>
        <p className="mt-[8px] max-w-[68ch] text-[14px] leading-[1.6] ink-muted">
          {SUPPORT_TEXT.requestBody}
        </p>
        <p className="mt-[6px] text-[12px] ink-subtle">{SUPPORT_TEXT.requestSignIn}</p>
      </div>
      <div className="flex flex-col gap-[10px] md:items-end">
        <ButtonLink href={SUPPORT_TEXT.requestHref} variant="primary" size="lg">
          {SUPPORT_TEXT.requestAction}
        </ButtonLink>
        <Link href={SUPPORT_TEXT.requestsHref} className="text-center text-[13px] font-bold">
          {SUPPORT_TEXT.requestsLink}
        </Link>
      </div>
    </section>
  );
}
