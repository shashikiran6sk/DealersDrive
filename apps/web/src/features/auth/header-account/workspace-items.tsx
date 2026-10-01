'use client';

import Link from 'next/link';

import { StatusTag } from '@/components/ui/primitives';
import type { AccountWorkspace } from '@/features/auth/customer-account-actions';

import { HEADER_ACCOUNT_TEXT } from './header-account.constants';
import { MENU_ITEM } from './header-account.styles';

export interface WorkspaceItemsProps {
  workspaces: readonly AccountWorkspace[];
  entering: string | null;
  onEnter: (membershipId: string) => void;
  onNavigate: () => void;
}

export function WorkspaceItems({ workspaces, entering, onEnter, onNavigate }: WorkspaceItemsProps) {
  if (workspaces.length === 0) {
    return (
      <Link
        role="menuitem"
        href={HEADER_ACCOUNT_TEXT.dealerLoginHref}
        className={MENU_ITEM}
        onClick={onNavigate}
      >
        {HEADER_ACCOUNT_TEXT.dealerLogin}
      </Link>
    );
  }

  return (
    <div role="group" aria-label={HEADER_ACCOUNT_TEXT.workspacesLabel} className="flex flex-col">
      {workspaces.map((workspace) =>
        workspace.enterable ? (
          <button
            key={workspace.membershipId}
            role="menuitem"
            type="button"
            aria-current={workspace.current ? 'true' : undefined}
            disabled={entering !== null}
            className={`${MENU_ITEM} flex-col items-start justify-center gap-[1px] py-[8px]`}
            onClick={() => {
              onEnter(workspace.membershipId);
            }}
          >
            <span className="flex w-full min-w-0 items-center gap-[8px]">
              <span className="min-w-0 truncate">{workspace.brandName}</span>
              {workspace.current ? (
                <StatusTag tone="ok" className="flex-none">
                  {HEADER_ACCOUNT_TEXT.workspaceCurrent}
                </StatusTag>
              ) : null}
            </span>
            <span className="text-[12px] font-semibold ink-subtle">
              {entering === workspace.membershipId
                ? HEADER_ACCOUNT_TEXT.opening
                : HEADER_ACCOUNT_TEXT.workspaceLabel(workspace.roleLabel)}
            </span>
          </button>
        ) : (
          <div key={workspace.membershipId} className="px-[12px] py-[8px]">
            <div className="truncate text-[14px] font-bold ink-muted">{workspace.brandName}</div>
            <div className="text-[12px] ink-subtle">{HEADER_ACCOUNT_TEXT.workspaceSuspended}</div>
          </div>
        ),
      )}
    </div>
  );
}
