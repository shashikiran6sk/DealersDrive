'use client';

import { useState, useTransition } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { customerSignUpAction } from '@/features/auth/sign-in-actions';

import { LOGIN_TEXT } from './login.constants';

export interface CustomerNameStepProps {
  phoneDisplay: string;
  onCreated: () => void;
  onRestart: () => void;
}

export function CustomerNameStep({ phoneDisplay, onCreated, onRestart }: CustomerNameStepProps) {
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-[14px]"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await customerSignUpAction(name);
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

      <Button type="submit" variant="primary" size="md" block loading={pending}>
        {pending ? LOGIN_TEXT.creating : LOGIN_TEXT.createAccount}
      </Button>
    </form>
  );
}
