'use client';

import { useActionState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Banner } from '@/components/ui/primitives';
import { adminLoginAction, type ActionState } from '@/features/auth/actions';

/**
 * Email and password, submitted to a Server Action.
 *
 * The action is what talks to the API and what sets the cookie, so no token
 * ever reaches this component — there is nothing here to put in `localStorage`
 * even by accident. `useActionState` keeps the typed email through a failed
 * attempt, which is the difference between a wrong password and a form that
 * punishes you for one.
 */
export function AdminLoginForm({ initialMessage }: { initialMessage?: string }) {
  const [state, submit, pending] = useActionState<ActionState, FormData>(adminLoginAction, {
    ...(initialMessage ? { message: initialMessage } : {}),
  });

  return (
    <form action={submit} className="flex flex-col gap-[14px]" noValidate>
      {/* `Banner` is already `role="status"`, which announces the failure. */}
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}

      <Field id="email" label="Work email" error={state.errors?.email}>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="username"
          required
          autoFocus
          {...invalidProps('email', state.errors?.email)}
        />
      </Field>

      <Field id="password" label="Password" error={state.errors?.password}>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
          {...invalidProps('password', state.errors?.password)}
        />
      </Field>

      <button type="submit" className="btn btn-primary h-11 text-[15px]" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-[12px] ink-subtle">
        Accounts are created by the platform team. There is no self-service sign-up.
      </p>
    </form>
  );
}
