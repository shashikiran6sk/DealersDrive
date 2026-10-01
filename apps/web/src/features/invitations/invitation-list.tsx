import { EmptyState } from '@/components/ui/primitives';

import { InvitationItem } from './invitation-item';
import { INVITATIONS_TEXT } from './invitations.constants';
import type { InvitationListProps } from './invitations.types';

export function InvitationList({ invitations }: InvitationListProps) {
  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <h1 className="text-[26px] sm:text-[30px]">{INVITATIONS_TEXT.title}</h1>
        <p className="mt-[6px] text-[14px] ink-muted">{INVITATIONS_TEXT.intro}</p>
      </div>
      {invitations.length === 0 ? (
        <EmptyState title={INVITATIONS_TEXT.emptyTitle} message={INVITATIONS_TEXT.emptyMessage} />
      ) : (
        <ul
          aria-label={INVITATIONS_TEXT.listLabel}
          className="m-0 flex list-none flex-col gap-[10px] p-0"
        >
          {invitations.map((invitation) => (
            <InvitationItem key={invitation.id} invitation={invitation} />
          ))}
        </ul>
      )}
    </div>
  );
}
