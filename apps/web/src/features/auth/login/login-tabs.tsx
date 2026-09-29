'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { LOGIN_AUDIENCES, LOGIN_TEXT } from './login.constants';
import type { LoginAudience } from './login.types';

export interface LoginTabsProps {
  initial: LoginAudience;
  customer: ReactNode;
  dealer: ReactNode;
}

export function LoginTabs({ initial, customer, dealer }: LoginTabsProps) {
  const [active, setActive] = useState<LoginAudience>(initial);
  const tabs = useRef<Partial<Record<LoginAudience, HTMLButtonElement | null>>>({});

  function select(next: LoginAudience): void {
    setActive(next);
    tabs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const index = LOGIN_AUDIENCES.indexOf(active);
    const last = LOGIN_AUDIENCES.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? LOGIN_AUDIENCES[index === last ? 0 : index + 1]
        : event.key === 'ArrowLeft'
          ? LOGIN_AUDIENCES[index === 0 ? last : index - 1]
          : event.key === 'Home'
            ? LOGIN_AUDIENCES[0]
            : event.key === 'End'
              ? LOGIN_AUDIENCES[last]
              : undefined;
    if (!target) return;
    event.preventDefault();
    select(target);
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div
        role="tablist"
        aria-label={LOGIN_TEXT.tabsLabel}
        className="flex items-center justify-end gap-[10px]"
        onKeyDown={onKeyDown}
      >
        {LOGIN_AUDIENCES.map((audience, index) => (
          <span key={audience} className="contents">
            {index === 1 ? (
              <span
                aria-hidden="true"
                data-slot="switch"
                className={cn(
                  'relative h-[26px] w-[44px] flex-none cursor-pointer rounded-full border border-(--color-divider) p-[3px] transition-colors',
                  active === 'dealer' ? 'bg-(--color-ink)' : 'bg-(--color-neutral-300)',
                )}
                onClick={() => {
                  select(active === 'dealer' ? 'customer' : 'dealer');
                }}
              >
                <span
                  className={cn(
                    'block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform',
                    active === 'dealer' && 'translate-x-[18px]',
                  )}
                />
              </span>
            ) : null}
            <button
              ref={(element) => {
                tabs.current[audience] = element;
              }}
              type="button"
              role="tab"
              id={`login-tab-${audience}`}
              aria-controls={`login-panel-${audience}`}
              aria-selected={active === audience}
              tabIndex={active === audience ? 0 : -1}
              className={cn(
                'min-h-[44px] rounded-[8px] px-[4px] text-[13px] transition-colors',
                active === audience
                  ? 'font-extrabold text-(--color-ink)'
                  : 'font-bold ink-muted hover:text-(--color-ink)',
              )}
              onClick={() => {
                select(audience);
              }}
            >
              {LOGIN_TEXT.tabs[audience]}
            </button>
          </span>
        ))}
      </div>

      <div
        role="tabpanel"
        id="login-panel-customer"
        aria-labelledby="login-tab-customer"
        hidden={active !== 'customer'}
      >
        {customer}
      </div>
      <div
        role="tabpanel"
        id="login-panel-dealer"
        aria-labelledby="login-tab-dealer"
        hidden={active !== 'dealer'}
      >
        {dealer}
      </div>
    </div>
  );
}
