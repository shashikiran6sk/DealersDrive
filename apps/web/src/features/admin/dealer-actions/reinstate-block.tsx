'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { reinstateDealerAction } from '@/features/admin/actions';

import { DEALER_ACTIONS_TEXT } from './dealer-actions.constants';
import type { ActionBlockProps } from './dealer-actions.types';

export interface ReinstateBlockProps extends ActionBlockProps {
  dealer: AdminDealerDetail;
  note: string;
  onNoteChange: (value: string) => void;
}

/** SUSPENDED is not a terminal state and the console should not present it as one. */
export function ReinstateBlock({
  dealer,
  pending,
  run,
  note,
  onNoteChange,
}: ReinstateBlockProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-(--color-divider) pt-3">
      <Field id="reinstateNote" label={DEALER_ACTIONS_TEXT.noteLabel} className="min-w-[220px] flex-1">
        <Input
          id="reinstateNote"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={DEALER_ACTIONS_TEXT.reinstateNotePlaceholder}
        />
      </Field>
      <Button
        variant="primary"
        size="md"
        loading={pending}
        onClick={() =>
          run(
            () =>
              reinstateDealerAction(
                dealer.id,
                { ...(note.trim() ? { note: note.trim() } : {}) },
                dealer.slug,
              ),
            DEALER_ACTIONS_TEXT.reinstated,
          )
        }
      >
        {DEALER_ACTIONS_TEXT.reinstate}
      </Button>
      <p className="w-full text-[12px] ink-muted">{DEALER_ACTIONS_TEXT.reinstateNote}</p>
    </div>
  );
}
