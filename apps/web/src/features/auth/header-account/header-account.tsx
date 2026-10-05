'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import {
  customerLogoutAction,
  enterWorkspaceAction,
  type CustomerAccount,
} from '@/features/auth/customer-account-actions';
import { announceAuthHint, rememberAuthHint, useAuthHint } from '@/lib/use-auth-hint';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { fetchCustomerAccount } from './account-client';
import { AccountMenu } from './account-menu';
import { HEADER_ACCOUNT_TEXT } from './header-account.constants';
import type { HeaderAccountProps } from './header-account.types';

interface Lookup {
  account: CustomerAccount | null;
}

function LoginLink({ className }: { className?: string }) {
  return (
    <Link
      href={HEADER_ACCOUNT_TEXT.loginHref}
      className={`relative btn btn-primary min-h-[40px] rounded-full px-[18px] ${className ?? ''}`}
    >
      <LinkPendingLabel>{HEADER_ACCOUNT_TEXT.login}</LinkPendingLabel>
    </Link>
  );
}

function AccountPlaceholder({ className }: { className?: string }) {
  return (
    <span
      data-auth-placeholder=""
      aria-hidden="true"
      className={`block h-[40px] w-[40px] flex-none rounded-full bg-(--color-neutral-150) ${className ?? ''}`}
    />
  );
}

export function HeaderAccount({
  initialAccount,
  afterLogoutHref,
  loadAccount = fetchCustomerAccount,
}: HeaderAccountProps = {}) {
  const router = useRouter();
  const known = initialAccount !== undefined;
  const hint = useAuthHint();
  const [lookup, setLookup] = useState<Lookup | null>(known ? { account: initialAccount } : null);
  const [loggingOut, startLogout] = useNavigationSafeAction();
  const [, startEntering] = useNavigationSafeAction();
  const [entering, setEntering] = useState<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      inflight.current?.abort();
      inflight.current = null;
    },
    [],
  );

  useEffect(() => {
    if (known) {
      if (initialAccount && hint !== 'in') rememberAuthHint(true);
      return;
    }
    if (hint === 'out') {
      inflight.current?.abort();
      inflight.current = null;
      setLookup((current) => (current?.account === null ? current : { account: null }));
      return;
    }
    if (lookup !== null || inflight.current) return;

    const controller = new AbortController();
    inflight.current = controller;
    loadAccount(controller.signal)
      .then((account) => {
        if (controller.signal.aborted) return;
        setLookup({ account });
        announceAuthHint();
      })
      .catch(() => {
        if (!controller.signal.aborted) setLookup({ account: null });
      })
      .finally(() => {
        if (inflight.current === controller) inflight.current = null;
      });
  }, [hint, initialAccount, known, loadAccount, lookup]);

  const account = lookup?.account;

  if (account) {
    return (
      <AccountMenu
        account={account}
        loggingOut={loggingOut}
        enteringWorkspace={entering}
        onEnterWorkspace={(membershipId) => {
          setEntering(membershipId);
          startEntering(async () => {
            try {
              await enterWorkspaceAction(membershipId);
            } finally {
              setEntering(null);
            }
          });
        }}
        onLogout={() => {
          if (loggingOut) return;
          startLogout(async () => {
            await customerLogoutAction();
            announceAuthHint();
            setLookup({ account: null });
            if (afterLogoutHref) router.push(afterLogoutHref);
            else router.refresh();
          });
        }}
      />
    );
  }

  if (account === null || hint === 'out') return <LoginLink />;
  if (hint === 'in') return <AccountPlaceholder />;

  return (
    <>
      <LoginLink className="auth-out-only" />
      <AccountPlaceholder className="auth-in-only" />
    </>
  );
}
