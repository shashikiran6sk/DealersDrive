'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import {
  customerAccountAction,
  customerLogoutAction,
  type CustomerAccount,
} from '@/features/auth/customer-account-actions';

import { AccountMenu } from './account-menu';
import { HEADER_ACCOUNT_TEXT } from './header-account.constants';

export function HeaderAccount() {
  const router = useRouter();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let live = true;
    customerAccountAction()
      .then((found) => {
        if (live) setAccount(found);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  if (!account) {
    return (
      <Link href={HEADER_ACCOUNT_TEXT.loginHref} className="btn btn-primary">
        {HEADER_ACCOUNT_TEXT.login}
      </Link>
    );
  }

  return (
    <AccountMenu
      account={account}
      loggingOut={pending}
      onLogout={() => {
        startTransition(async () => {
          await customerLogoutAction();
          setAccount(null);
          router.refresh();
        });
      }}
    />
  );
}
