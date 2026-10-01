'use client';

import * as Popover from '@radix-ui/react-popover';
import Link from 'next/link';
import { useRef, useState, type KeyboardEvent } from 'react';

import { personInitials } from '@/lib/person';

import { HEADER_ACCOUNT_TEXT } from './header-account.constants';
import type { AccountMenuProps } from './header-account.types';

const ITEM =
  'flex min-h-[44px] w-full items-center rounded-[8px] px-[12px] text-left text-[14px] font-bold text-(--color-ink) no-underline outline-none hover:bg-(--color-neutral-100) focus-visible:bg-(--color-neutral-150) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--color-focus) disabled:opacity-45';

const SEPARATOR = 'my-[4px] border-t border-(--color-divider)';

function moveFocus(menu: HTMLElement | null, key: string): boolean {
  const items = Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  if (items.length === 0) return false;
  const at = items.findIndex((item) => item === document.activeElement);
  const next =
    key === 'ArrowDown'
      ? (at + 1) % items.length
      : key === 'ArrowUp'
        ? (at - 1 + items.length) % items.length
        : key === 'Home'
          ? 0
          : key === 'End'
            ? items.length - 1
            : null;
  if (next === null) return false;
  items[next]?.focus();
  return true;
}

export function AccountMenu({ account, onLogout, loggingOut }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const initials = personInitials(account.fullName);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (moveFocus(menu.current, event.key)) event.preventDefault();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-haspopup="menu"
          aria-label={HEADER_ACCOUNT_TEXT.menuLabel(account.fullName)}
          className="grid h-[40px] w-[40px] place-items-center rounded-full bg-(--color-accent) text-[13px] font-extrabold text-white outline-offset-2 hover:bg-(--color-neutral-800)"
        >
          <span aria-hidden="true">{initials}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
          }}
          className="z-50 w-[240px] max-w-[calc(100vw-24px)] rounded-[14px] border border-(--color-divider) bg-white p-[6px] shadow-md"
        >
          <div className="mb-[4px] border-b border-(--color-divider) px-[12px] pt-[8px] pb-[10px]">
            <div className="truncate text-[14px] font-extrabold">{account.fullName}</div>
            <div className="text-[12px] ink-subtle tnum">{account.phoneMasked}</div>
          </div>
          <div
            ref={menu}
            role="menu"
            aria-label={HEADER_ACCOUNT_TEXT.menuItemsLabel}
            onKeyDown={onKeyDown}
            className="flex flex-col"
          >
            <Link
              role="menuitem"
              href={HEADER_ACCOUNT_TEXT.savedCarsHref}
              className={ITEM}
              onClick={() => setOpen(false)}
            >
              {HEADER_ACCOUNT_TEXT.savedCars}
            </Link>
            <Link
              role="menuitem"
              href={HEADER_ACCOUNT_TEXT.myEnquiriesHref}
              className={ITEM}
              onClick={() => setOpen(false)}
            >
              {HEADER_ACCOUNT_TEXT.myEnquiries}
            </Link>
            <Link
              role="menuitem"
              href={HEADER_ACCOUNT_TEXT.supportRequestsHref}
              className={ITEM}
              onClick={() => setOpen(false)}
            >
              {HEADER_ACCOUNT_TEXT.supportRequests}
            </Link>
            <div role="separator" className={SEPARATOR} />
            <Link
              role="menuitem"
              href={HEADER_ACCOUNT_TEXT.dealerLoginHref}
              className={ITEM}
              onClick={() => setOpen(false)}
            >
              {HEADER_ACCOUNT_TEXT.dealerLogin}
            </Link>
            <div role="separator" className={SEPARATOR} />
            <button
              role="menuitem"
              type="button"
              disabled={loggingOut}
              className={ITEM}
              onClick={() => {
                onLogout();
              }}
            >
              {loggingOut ? HEADER_ACCOUNT_TEXT.loggingOut : HEADER_ACCOUNT_TEXT.logout}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
