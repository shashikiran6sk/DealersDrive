'use client';
import {
  PROGRESSIVE_DECLARATION,
  type AuthSession,
  type PhoneOtpWidget,
} from '@dealers-drive/contracts';
import { useActionState, useState } from 'react';
import { Field } from '@/components/forms/field';
import { Banner, Stepper } from '@/components/ui/primitives';
import { AccountStep } from '@/features/auth/onboarding-wizard/account-step';
import { PhoneVerification } from '@/features/auth/phone-verification';
import { registerProgressiveAction, registerProgressiveAssistedAction } from './actions';

export function ProgressiveRegistration({
  session,
  widget,
  googleLinkUrl,
}: {
  session: AuthSession;
  widget: PhoneOtpWidget | null;
  googleLinkUrl: string | null;
}) {
  const [state, action, pending] = useActionState(registerProgressiveAction, {});
  const [fullName, setFullName] = useState(session.user.fullName ?? session.identity?.name ?? '');
  const [phone, setPhone] = useState((session.user.phone ?? '').replace(/^\+91/, ''));
  const [verified, setVerified] = useState(session.user.phoneVerified);
  return (
    <div className="flex flex-col gap-5">
      <Stepper steps={['Register', 'Verify', 'Activate']} current={0} />
      <p className="text-[14px] ink-secondary">
        Save the essentials now. Complete the evidence applicable to your business before
        activation.
      </p>
      <form action={action} className="flex flex-col gap-5">
        {state.message ? <Banner tone="err">{state.message}</Banner> : null}
        <AccountStep
          session={session}
          errors={state.errors ?? {}}
          hidden={false}
          fullName={fullName}
          onFullNameChange={setFullName}
          phone={phone}
          onPhoneChange={(value) => {
            setPhone(value);
            setVerified(false);
          }}
          phoneVerified={verified}
          googleLinkUrl={googleLinkUrl}
        />
        <PhoneVerification
          widget={widget}
          phone={phone}
          fullName={fullName}
          verified={verified}
          onBeforeSend={() => fullName.trim().length >= 2}
          onVerified={() => setVerified(true)}
          continueLabel="Continue registration"
          onContinue={() => document.getElementById('legalName')?.focus()}
        />
        <RegistrationFields errors={state.errors} />
        <button
          className="btn btn-primary min-h-11"
          disabled={pending || !verified || !session.identity}
          type="submit"
        >
          {pending ? 'Saving…' : 'Save registration'}
        </button>
      </form>
    </div>
  );
}
export function ProgressiveAssistedRegistration({ ticket }: { ticket: string }) {
  const [state, action, pending] = useActionState(registerProgressiveAssistedAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Stepper steps={['Register', 'Verify', 'Activate']} current={0} />
      <input type="hidden" name="phoneTicket" value={ticket} />
      <p className="text-[13px] ink-secondary">
        Assist with the representative’s consent. Their email must be verified before activation;
        entering it does not establish ownership.
      </p>
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}
      <Field id="contactName" label="Representative name" error={state.errors?.contactName}>
        <input className="input" id="contactName" name="contactName" required maxLength={80} />
      </Field>
      <Field id="email" label="Representative email" error={state.errors?.email}>
        <input className="input" id="email" name="email" type="email" required maxLength={160} />
      </Field>
      <RegistrationFields errors={state.errors} />
      <button className="btn btn-primary min-h-11" disabled={pending}>
        {pending ? 'Saving…' : 'Save registration'}
      </button>
    </form>
  );
}
function RegistrationFields({ errors }: { errors?: Record<string, string> }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ['legalName', 'Dealership name', 160],
            ['city', 'Town / city', 80],
            ['district', 'District', 80],
            ['state', 'State', 80],
          ] as const
        ).map(([name, label, max]) => (
          <Field key={name} id={name} label={label} error={errors?.[name]}>
            <input className="input" id={name} name={name} maxLength={max} required />
          </Field>
        ))}
      </div>
      <Field id="declaration" label="Authorization and consent" error={errors?.declaration}>
        <label className="flex items-start gap-3 text-[13px]">
          <input
            id="declaration"
            name="declaration"
            type="checkbox"
            className="mt-1 h-5 w-5 flex-none"
            required
          />
          <span>{PROGRESSIVE_DECLARATION}</span>
        </label>
      </Field>
    </>
  );
}
