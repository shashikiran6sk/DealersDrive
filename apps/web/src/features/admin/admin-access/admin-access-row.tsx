'use client';

import type { AdminAccessEntry } from '@dealers-drive/contracts';

import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/primitives';

import { ADMIN_ACCESS_TEXT, ROLE_LABELS } from './admin-access.constants';

export interface AdminAccessRowProps {
  entry: AdminAccessEntry;
  currentUserId: string;
  pending: boolean;
  onRevoke: (entry: AdminAccessEntry) => void;
}

export function AdminAccessRow({ entry, currentUserId, pending, onRevoke }: AdminAccessRowProps) {
  return (
    <tr>
      <td>
        <div>{entry.email}</div>
        {entry.fullName ? <div className="text-[11px] ink-faint">{entry.fullName}</div> : null}
      </td>
      <td>{ROLE_LABELS[entry.adminRole]}</td>
      <td>
        <Tag>{entry.sourceLabel}</Tag>
        {entry.grantedByEmail ? (
          <div className="text-[11px] ink-faint">
            {ADMIN_ACCESS_TEXT.grantedBy(entry.grantedByEmail)}
          </div>
        ) : null}
      </td>
      <td>{entry.lastLoginLabel}</td>
      <td className="text-right">
        {entry.userId !== null && entry.userId === currentUserId ? (
          <span className="text-[11px] ink-faint">{ADMIN_ACCESS_TEXT.you}</span>
        ) : entry.canRevoke ? (
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() => {
              onRevoke(entry);
            }}
          >
            {ADMIN_ACCESS_TEXT.withdraw}
          </Button>
        ) : (
          <span className="text-[11px] ink-faint">{entry.revokeBlockedReason}</span>
        )}
      </td>
    </tr>
  );
}
