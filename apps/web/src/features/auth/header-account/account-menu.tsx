'use client';

import * as Popover from '@radix-ui/react-popover';
import Link from 'next/link';
import { useRef, useState, type KeyboardEvent } from 'react';

import { personInitials } from '@/lib/person';

import { HEADER_ACCOUNT_TEXT } from './header-account.constants';
import type { AccountMenuProps } from './header-account.types';

const ITEM =
  'flex min-h-[40px] w-full items-center px-[14px] text-left text-[14px] text-(--color-ink) no-underline outline-none hover:bg-(--color-bg) focus-visible:bg-(--color-accent-100)';

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
          className="grid h-[36px] w-[36px] place-items-center rounded-full bg-(--color-accent-200) text-[13px] font-bold text-(--color-accent-800) outline-offset-2 hover:bg-(--color-accent-300)"
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
          className="z-50 w-[240px] max-w-[calc(100vw-24px)] border border-(--color-divider) bg-white py-[6px] shadow-lg"
        >
          <div className="border-b border-(--color-divider) px-[14px] pt-[6px] pb-[10px]">
            <div className="truncate text-[14px] font-semibold">{account.fullName}</div>
            <div className="text-[12px] ink-subtle tnum">{account.phoneMasked}</div>
          </div>
          <div
            ref={menu}
            role="menu"
            aria-label={HEADER_ACCOUNT_TEXT.menuItemsLabel}
            onKeyDown={onKeyDown}
            className="flex flex-col pt-[4px]"
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
            <div role="separator" className="my-[4px] border-t border-(--color-divider)" />
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
