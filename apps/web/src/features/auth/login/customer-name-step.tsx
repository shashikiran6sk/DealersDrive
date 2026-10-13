'use client';

import { LEGAL_VERSION } from '@dealers-drive/contracts';
import { LegalCheck } from '@/features/legal/legal-check';
import { useLegalEnabled } from '@/features/legal/legal-provider';
import { useState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { customerSignUpAction } from '@/features/auth/sign-in-actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { LOGIN_TEXT } from './login.constants';

export interface CustomerNameStepProps {
  phoneDisplay: string;
  onCreated: () => void;
  onRestart: () => void;
}

export function CustomerNameStep({ phoneDisplay, onCreated, onRestart }: CustomerNameStepProps) {
  const legal = useLegalEnabled();
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useNavigationSafeAction();

  return (
    <form
      className="flex flex-col gap-[14px]"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (legal && !agreed) {
          setError('Accept the Terms and acknowledge the Privacy Policy to create your account.');
          return;
        }
        startTransition(async () => {
          const result = legal
            ? await customerSignUpAction(name, {
                version: LEGAL_VERSION,
                accepted: true,
                privacyAcknowledged: true,
              })
            : await customerSignUpAction(name);
          if (result.done) {
            onCreated();
            return;
          }
          setFieldError(result.fieldError ?? null);
          setError(result.error ?? null);
        });
      }}
    >
      <Banner tone="ok" title={LOGIN_TEXT.nameVerified}>
        {LOGIN_TEXT.nameIntro(phoneDisplay)}
      </Banner>

      {error ? (
        <Banner
          tone="err"
          title={error}
          action={
            <Button variant="secondary" size="sm" onClick={onRestart}>
              {LOGIN_TEXT.startAgain}
            </Button>
          }
        />
      ) : null}

      <Field id="customer-name" label={LOGIN_TEXT.nameLabel} error={fieldError ?? undefined}>
        <input
          id="customer-name"
          name="fullName"
          className="input"
          autoComplete="name"
          autoFocus
          placeholder={LOGIN_TEXT.namePlaceholder}
          maxLength={80}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setFieldError(null);
          }}
          required
          aria-required="true"
          {...invalidProps('customer-name', fieldError ?? undefined)}
        />
      </Field>

      <LegalCheck kind="account" onCompleteChange={setAgreed} />
      <Button type="submit" variant="primary" size="md" block loading={pending}>
        {pending ? LOGIN_TEXT.creating : LOGIN_TEXT.createAccount}
      </Button>
    </form>
  );
}
