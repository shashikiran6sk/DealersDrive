'use client';

import {
  CreateYardVisitInput,
  YARD_VISIT_OUTCOME_LABELS,
  YardVisitOutcome,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { recordYardVisitAction } from '@/features/admin/actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { MAX_VISIT_NOTES, YARD_VISITS_TEXT } from './yard-visits.constants';
import type { RecordVisitFormProps } from './yard-visits.types';

export function RecordVisitForm({ dealerId }: RecordVisitFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useNavigationSafeAction();
  const [visitedOn, setVisitedOn] = useState('');
  const [outcome, setOutcome] = useState<YardVisitOutcome>('YARD_CONFIRMED');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const body = { visitedOn, outcome, ...(notes.trim() ? { notes: notes.trim() } : {}) };
  const valid = CreateYardVisitInput.safeParse(body).success;

  function submit() {
    if (!valid || pending) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await recordYardVisitAction(dealerId, body);
      if (!result.ok) {
        setError(result.message ?? YARD_VISITS_TEXT.recordFailed);
        return;
      }
      setNotice(YARD_VISITS_TEXT.recorded);
      setVisitedOn('');
      setNotes('');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-(--color-divider) pt-3">
      <h3 className="text-[15px] font-medium">{YARD_VISITS_TEXT.recordHeading}</h3>
      {error ? <Banner tone="err">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}
      <div className="flex flex-wrap gap-3">
        <Field
          id="yardVisitDate"
          label={YARD_VISITS_TEXT.dateLabel}
          className="min-w-[160px] max-md:min-w-0 max-md:basis-full"
        >
          <Input
            id="yardVisitDate"
            type="date"
            value={visitedOn}
            onChange={(event) => setVisitedOn(event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field
          id="yardVisitOutcome"
          label={YARD_VISITS_TEXT.outcomeLabel}
          className="min-w-[220px] flex-1 max-md:min-w-0 max-md:basis-full"
        >
          <Select
            id="yardVisitOutcome"
            value={outcome}
            onChange={(event) => {
              const parsed = YardVisitOutcome.safeParse(event.target.value);
              if (parsed.success) setOutcome(parsed.data);
            }}
            disabled={pending}
          >
            {YardVisitOutcome.options.map((option) => (
              <option key={option} value={option}>
                {YARD_VISIT_OUTCOME_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id="yardVisitNotes" label={YARD_VISITS_TEXT.notesLabel}>
        <Textarea
          id="yardVisitNotes"
          value={notes}
          rows={3}
          maxLength={MAX_VISIT_NOTES}
          placeholder={YARD_VISITS_TEXT.notesPlaceholder}
          onChange={(event) => setNotes(event.target.value)}
          disabled={pending}
        />
      </Field>
      <Button
        variant="secondary"
        size="md"
        className="self-start"
        loading={pending}
        disabled={!valid}
        onClick={submit}
      >
        {YARD_VISITS_TEXT.record}
      </Button>
    </div>
  );
}
