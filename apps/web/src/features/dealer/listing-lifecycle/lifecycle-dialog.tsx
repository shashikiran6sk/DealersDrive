'use client';

import { WithdrawalReason } from '@dealers-drive/contracts';
import { useId, useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select, Textarea } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';

import {
  LIFECYCLE_MOVES,
  LIFECYCLE_TEXT,
  WITHDRAWAL_NOTE_MAX,
  WITHDRAWAL_REASON_OPTIONS,
} from './listing-lifecycle.constants';
import type { LifecycleDialogProps } from './listing-lifecycle.types';

export function LifecycleDialog({ vehicleId, action, size, submit }: LifecycleDialogProps) {
  const move = LIFECYCLE_MOVES[action];
  const withdrawing = action === 'withdraw';
  const ids = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const parsedReason = WithdrawalReason.safeParse(reason);
  const ready = !withdrawing || parsedReason.success;

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setReason('');
      setNote('');
      setMessage(undefined);
    }
  }

  function confirm() {
    startTransition(async () => {
      const result = await submit(
        vehicleId,
        action,
        withdrawing && parsedReason.success
          ? { reason: parsedReason.data, ...(note.trim() ? { note: note.trim() } : {}) }
          : undefined,
      );
      if (result.ok) reset(false);
      else setMessage(result.message);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={reset}
      title={move.title}
      description={move.description}
      trigger={
        <Button
          variant={move.tone === 'danger' ? 'destructive' : 'secondary'}
          size={size === 'sm' ? 'sm' : 'default'}
        >
          {move.label}
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => reset(false)} disabled={pending}>
            {LIFECYCLE_TEXT.cancel}
          </Button>
          <Button
            variant={move.tone === 'danger' ? 'danger' : 'primary'}
            onClick={confirm}
            disabled={!ready}
            loading={pending}
          >
            {move.confirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {message ? <Banner tone="err">{message}</Banner> : null}
        {withdrawing ? (
          <>
            <Field id={`${ids}-reason`} label={LIFECYCLE_TEXT.reasonLabel}>
              <Select
                id={`${ids}-reason`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
              >
                <option value="" disabled>
                  {LIFECYCLE_TEXT.reasonPlaceholder}
                </option>
                {WITHDRAWAL_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id={`${ids}-note`}
              label={LIFECYCLE_TEXT.noteLabel}
              hint={LIFECYCLE_TEXT.noteHint}
            >
              <Textarea
                id={`${ids}-note`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={WITHDRAWAL_NOTE_MAX}
              />
            </Field>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
