'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { WebsiteActionState } from '../actions';
import { WebsiteUploadContext } from './upload-context';

export function WebsiteActionForm({
  action,
  label,
  children,
  disabled = false,
}: {
  action: (state: WebsiteActionState, form: FormData) => Promise<WebsiteActionState>;
  label: string;
  children?: ReactNode;
  disabled?: boolean;
}) {
  const [uploads, setUploads] = useState(0);
  const [state, submit, pending] = useActionState(action, {
    status: 'idle',
  } satisfies WebsiteActionState);
  return (
    <WebsiteUploadContext.Provider
      value={(delta) => setUploads((count) => Math.max(0, count + delta))}
    >
      <form
        action={submit}
        className="flex min-w-0 flex-col gap-4"
        onSubmit={(event) => {
          if (uploads > 0) event.preventDefault();
        }}
      >
        <fieldset
          disabled={disabled || pending}
          className="flex min-w-0 flex-col gap-4 border-0 p-0"
        >
          {children}
          <Button
            type="submit"
            loading={pending}
            disabled={disabled || pending || uploads > 0}
            className="min-h-[44px] w-fit"
          >
            {label}
          </Button>
        </fieldset>
        {state.message ? (
          <p
            role={state.status === 'error' ? 'alert' : 'status'}
            className={`text-[13px] ${state.status === 'error' ? 'text-(--color-err)' : 'ink-muted'}`}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </WebsiteUploadContext.Provider>
  );
}
