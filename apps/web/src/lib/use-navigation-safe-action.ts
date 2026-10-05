'use client';

import { usePathname, useRouter } from 'next/navigation';
import { startTransition, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { redirectTargetOf } from './redirect-target';

export type SafeActionStart = (work: () => Promise<void>) => void;

export function useNavigationSafeAction(): [boolean, SafeActionStart] {
  const router = useRouter();
  const pathname = usePathname();
  const current = useRef(pathname);
  current.current = pathname;
  const mounted = useRef(false);
  const inFlight = useRef(0);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback<SafeActionStart>(
    (work) => {
      const origin = current.current;
      inFlight.current += 1;
      setPending(true);
      work()
        .catch((error: unknown) => {
          const target = redirectTargetOf(error);
          if (target === null) {
            if (mounted.current) setFailure({ error });
            return;
          }
          if (!mounted.current || current.current !== origin) return;
          startTransition(() => {
            if (target.replace) router.replace(target.href);
            else router.push(target.href);
          });
        })
        .finally(() => {
          inFlight.current -= 1;
          if (mounted.current && inFlight.current === 0) setPending(false);
        });
    },
    [router],
  );

  if (failure) throw failure.error;

  return [pending, start];
}

function submitterOf(event: Event, form: HTMLFormElement): HTMLElement | null {
  const submitter = 'submitter' in event ? event.submitter : null;
  if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
    return submitter.form === form && submitter.type === 'submit' ? submitter : null;
  }
  return null;
}

export function useNavigationSafeFormAction<State>(
  action: (previous: State, formData: FormData) => Promise<State>,
  initial: State,
): [State, (event: FormEvent<HTMLFormElement>) => void, boolean] {
  const [state, setState] = useState(initial);
  const latest = useRef(state);
  latest.current = state;
  const [pending, start] = useNavigationSafeAction();

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) return;
      const form = event.currentTarget;
      const formData = new FormData(form, submitterOf(event.nativeEvent, form));
      start(async () => {
        const next = await action(latest.current, formData);
        setState(next);
      });
    },
    [action, pending, start],
  );

  return [state, onSubmit, pending];
}
