'use client';

import { useRef, useState } from 'react';

import type { AccountWorkspace } from '@/features/auth/customer-account';
import { enterWorkspaceAction } from '@/features/auth/customer-account-actions';
import { WorkspaceItems } from '@/features/auth/header-account/workspace-items';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { CONSOLE_UTILITIES_TEXT } from './console-utilities.constants';

export function WorkspaceSwitcher({
  workspaces,
  invitations,
}: {
  workspaces: readonly AccountWorkspace[];
  invitations: number;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const [, startEntering] = useNavigationSafeAction();

  if (workspaces.length === 0 && invitations === 0) return null;

  return (
    <details
      ref={details}
      className="min-w-0 rounded-[10px] border border-(--color-divider) bg-white"
    >
      <summary className="min-h-11 cursor-pointer px-3 py-3 text-[13px] font-bold">
        {CONSOLE_UTILITIES_TEXT.switchWorkspace}
      </summary>
      <div
        role="menu"
        aria-label={CONSOLE_UTILITIES_TEXT.workspaces}
        className="flex max-h-[min(280px,40dvh)] min-w-0 flex-col overflow-y-auto overscroll-contain border-t border-(--color-divider) py-1"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (details.current) {
              details.current.open = false;
              details.current.querySelector('summary')?.focus();
            }
            return;
          }
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'),
          );
          const at = items.findIndex((item) => item === document.activeElement);
          const next =
            event.key === 'ArrowDown'
              ? (at + 1) % items.length
              : event.key === 'ArrowUp'
                ? (at - 1 + items.length) % items.length
                : event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? items.length - 1
                    : null;
          if (next !== null && items.length > 0) {
            event.preventDefault();
            items[next]?.focus();
          }
        }}
      >
        <WorkspaceItems
          workspaces={workspaces}
          invitations={invitations}
          entering={entering}
          onNavigate={() => {
            if (details.current) details.current.open = false;
          }}
          onEnter={(membershipId) => {
            if (entering !== null) return;
            setEntering(membershipId);
            startEntering(async () => {
              try {
                await enterWorkspaceAction(membershipId);
              } finally {
                setEntering(null);
              }
            });
          }}
        />
      </div>
    </details>
  );
}
