'use client';

import type { AdminMemberDto } from '@dealers-drive/contracts';
import { useState } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { MEMBERS_TEXT, MIN_REASON } from './admin-members.constants';

export interface DisableMemberDialogProps {
  member: AdminMemberDto;
  pending: boolean;
  onConfirm: (reason: string) => void;
}

export function DisableMemberDialog({ member, pending, onConfirm }: DisableMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const fieldId = `disable-reason-${member.id}`;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={MEMBERS_TEXT.disableTitle(member.email)}
      description={MEMBERS_TEXT.disableBody}
      trigger={
        <Button size="sm" variant="ghost">
          {MEMBERS_TEXT.disable}
        </Button>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
            {MEMBERS_TEXT.cancel}
          </Button>
          <Button
            variant="destructive"
            size="md"
            loading={pending}
            disabled={reason.trim().length < MIN_REASON}
            onClick={() => {
              onConfirm(reason.trim());
              setOpen(false);
              setReason('');
            }}
          >
            {MEMBERS_TEXT.confirmDisable}
          </Button>
        </div>
      }
    >
      <Field id={fieldId} label={MEMBERS_TEXT.reasonLabel}>
        <Input
          id={fieldId}
          value={reason}
          placeholder={MEMBERS_TEXT.reasonPlaceholder}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
    </Dialog>
  );
}
