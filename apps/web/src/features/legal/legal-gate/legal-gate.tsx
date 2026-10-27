'use client';

import type { LegalScope } from '@dealers-drive/contracts';
import { useActionState } from 'react';

import { LegalCheck } from '@/components/forms/legal-check';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { customerLogoutAction } from '@/features/auth/customer-account-actions';
import { signOutAction } from '@/features/auth/actions';
import { acceptLegalAction } from '@/features/legal/actions';
import { LEGAL_GATE_TEXT as TEXT } from './legal-gate.constants';

export function LegalGate({
  scope,
  returnTo,
  canAccept = true,
}: {
  scope: LegalScope;
  returnTo: string;
  canAccept?: boolean;
}) {
  const [state, submit, pending] = useActionState(
    acceptLegalAction.bind(null, scope, returnTo),
    {},
  );
  return (
    <section
      className="mx-auto w-full max-w-[520px] space-y-6 px-4 py-10"
      aria-labelledby="legal-gate-title"
    >
      <h1 id="legal-gate-title" className="font-heading text-[28px] font-extrabold">
        {TEXT.title}
      </h1>
      {state.message ? <Banner tone="err" title={state.message} /> : null}
      {canAccept ? (
        <form action={submit} className="space-y-6">
          <LegalCheck disabled={pending} />
          <Button type="submit" variant="primary" block loading={pending}>
            {pending ? TEXT.pending : TEXT.continue}
          </Button>
        </form>
      ) : (
        <Banner tone="warn" title={TEXT.ownerRequired} />
      )}
      <div className="flex flex-wrap items-center gap-6 text-[14px]">
        <form
          action={async () => {
            if (scope === 'DEALER') await signOutAction();
            else {
              await customerLogoutAction();
              window.location.assign('/');
            }
          }}
        >
          <button type="submit" className="min-h-11 underline">
            {TEXT.signOut}
          </button>
        </form>
        <a href="/contact" className="min-h-11 py-3 underline">
          {TEXT.support}
        </a>
      </div>
    </section>
  );
}
