'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';

import { replySupportRequestAction } from '@/features/support/support-actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';
import {
  SUPPORT_DETAIL_TEXT,
  SUPPORT_LIMITS,
  supportLoginHref,
} from './support-requests.constants';
import type { SupportReplyFormProps } from './support-requests.types';
import { supportRequestHref } from './utils';

export function SupportReplyForm({
  ticketId,
  hint,
  send = replySupportRequestAction,
}: SupportReplyFormProps) {
  const id = useId();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useNavigationSafeAction();
  const inFlight = useRef(false);

  return (
    <form
      noValidate
      className="flex flex-col gap-[10px]"
      onSubmit={(event) => {
        event.preventDefault();
        if (inFlight.current) return;
        inFlight.current = true;
        setError(null);
        startTransition(async () => {
          const result = await send(ticketId, message);
          inFlight.current = false;
          if (result.status === 'sent') {
            setMessage('');
            router.refresh();
            return;
          }
          if (result.status === 'signed-out') {
            router.push(supportLoginHref(supportRequestHref(ticketId)));
            return;
          }
          setError(result.message);
          if (result.status === 'refused') router.refresh();
        });
      }}
    >
      <label htmlFor={`${id}-reply`} className="text-[14px] font-bold">
        {SUPPORT_DETAIL_TEXT.replyLabel}
      </label>
      {hint ? <p className="text-[12px] ink-muted">{hint}</p> : null}
      <Textarea
        id={`${id}-reply`}
        name="message"
        rows={4}
        required
        maxLength={SUPPORT_LIMITS.message}
        placeholder={SUPPORT_DETAIL_TEXT.replyPlaceholder}
        className="min-h-[110px] py-[8px]"
        value={message}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setMessage(event.target.value);
        }}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="m-0 text-[13px] text-(--color-err)">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={pending}
          disabled={pending || message.trim() === ''}
          className="max-sm:w-full"
        >
          {SUPPORT_DETAIL_TEXT.send}
        </Button>
        {pending ? (
          <span role="status" className="sr-only">
            {SUPPORT_DETAIL_TEXT.sending}
          </span>
        ) : null}
      </div>
    </form>
  );
}
