'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import {
  customerAccountAction,
  customerLogoutAction,
  enterWorkspaceAction,
  type CustomerAccount,
} from '@/features/auth/customer-account-actions';

import { AccountMenu } from './account-menu';
import { HEADER_ACCOUNT_TEXT } from './header-account.constants';
import type { HeaderAccountProps } from './header-account.types';

export function HeaderAccount({ initialAccount, afterLogoutHref }: HeaderAccountProps = {}) {
  const router = useRouter();
  const [account, setAccount] = useState<CustomerAccount | null>(initialAccount ?? null);
  const [pending, startTransition] = useTransition();
  const [, startEntering] = useTransition();
  const [entering, setEntering] = useState<string | null>(null);
  const known = initialAccount !== undefined;

  useEffect(() => {
    if (known) return;
    let live = true;
    customerAccountAction()
      .then((found) => {
        if (live) setAccount(found);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [known]);

  if (!account) {
    return (
      <Link
        href={HEADER_ACCOUNT_TEXT.loginHref}
        className="relative btn btn-primary min-h-[40px] rounded-full px-[18px]"
      >
        <LinkPendingLabel>{HEADER_ACCOUNT_TEXT.login}</LinkPendingLabel>
      </Link>
    );
  }

  return (
    <AccountMenu
      account={account}
      loggingOut={pending}
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
        startTransition(async () => {
          await customerLogoutAction();
          setAccount(null);
          if (afterLogoutHref) router.push(afterLogoutHref);
          else router.refresh();
        });
      }}
    />
  );
}
