'use client';

import { initialsOf } from '@dealers-drive/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/primitives';
import {
  customerAccountAction,
  customerLogoutAction,
  type CustomerAccount,
} from '@/features/auth/customer-account-actions';

import { HEADER_ACCOUNT_TEXT } from './header-account.constants';
import { firstNameOf } from './utils';

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
    <div
      className="flex items-center gap-2"
      title={HEADER_ACCOUNT_TEXT.accountLabel(account.fullName)}
    >
      <Link
        href={HEADER_ACCOUNT_TEXT.myEnquiriesHref}
        aria-label={HEADER_ACCOUNT_TEXT.myEnquiries}
        className="sm:hidden"
      >
        <Avatar initials={initialsOf(account.fullName)} size={28} />
      </Link>
      <span className="max-w-[160px] truncate text-[13px] font-medium max-sm:sr-only">
        {HEADER_ACCOUNT_TEXT.greeting(firstNameOf(account.fullName))}
      </span>
      <Link
        href={HEADER_ACCOUNT_TEXT.myEnquiriesHref}
        className="text-[13px] font-medium whitespace-nowrap text-(--color-accent-700) max-sm:hidden"
      >
        {HEADER_ACCOUNT_TEXT.myEnquiries}
      </Link>
      <Button
        variant="secondary"
        loading={pending}
        onClick={() => {
          startTransition(async () => {
            await customerLogoutAction();
            setAccount(null);
            router.refresh();
          });
        }}
      >
        {HEADER_ACCOUNT_TEXT.logout}
      </Button>
    </div>
  );
}
