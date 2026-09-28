'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

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
        className="seg w-full"
        onKeyDown={onKeyDown}
      >
        {LOGIN_AUDIENCES.map((audience) => (
          <button
            key={audience}
            ref={(element) => {
              tabs.current[audience] = element;
            }}
            type="button"
            role="tab"
            id={`login-tab-${audience}`}
            aria-controls={`login-panel-${audience}`}
            aria-selected={active === audience}
            tabIndex={active === audience ? 0 : -1}
            className="seg-opt min-h-[44px] flex-1 justify-center"
            onClick={() => {
              select(audience);
            }}
          >
            {LOGIN_TEXT.tabs[audience]}
          </button>
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
