'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { addTicketNoteAction, replyToTicketAction } from '@/features/admin/support-actions';
import { cn } from '@/lib/cn';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { SUPPORT_TICKET_TEXT } from './support-ticket.constants';
import type { TicketComposerProps } from './support-ticket.types';

type Mode = 'reply' | 'note';

export function TicketComposer({
  ticketId,
  canReply,
  reply = replyToTicketAction,
  note = addTicketNoteAction,
}: TicketComposerProps) {
  const id = useId();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(canReply ? 'reply' : 'note');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useNavigationSafeAction();
  const inFlight = useRef(false);
  const replyId = useRef<string | null>(null);
  const isNote = mode === 'note';

  return (
    <form
      noValidate
      aria-labelledby={`${id}-heading`}
      className={cn(
        'card flex flex-col gap-[10px] p-4',
        isNote ? 'border-(--color-warn) bg-(--color-warn-bg)' : 'bg-white',
      )}
      onSubmit={(event) => {
        event.preventDefault();
        if (inFlight.current || text.trim() === '') return;
        inFlight.current = true;
        setError(null);
        startTransition(async () => {
          replyId.current ??= crypto.randomUUID();
          const result = isNote
            ? await note(ticketId, text)
            : await reply(ticketId, text, replyId.current);
          inFlight.current = false;
          if (result.ok) {
            setText('');
            replyId.current = null;
            router.refresh();
            return;
          }
          setError(result.message);
        });
      }}
    >
      <h2 id={`${id}-heading`} className="sr-only">
        {SUPPORT_TICKET_TEXT.composerLabel}
      </h2>
      <div
        role="radiogroup"
        aria-label={SUPPORT_TICKET_TEXT.composerLabel}
        className="seg self-start"
      >
        {(['reply', 'note'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={mode === option}
            aria-selected={mode === option}
            disabled={option === 'reply' && !canReply}
            className="seg-opt"
            onClick={() => {
              setMode(option);
              replyId.current = null;
              setError(null);
            }}
          >
            {option === 'reply' ? SUPPORT_TICKET_TEXT.replyMode : SUPPORT_TICKET_TEXT.noteMode}
          </button>
        ))}
      </div>

      <label htmlFor={`${id}-text`} className="text-[13px] font-bold">
        {isNote ? SUPPORT_TICKET_TEXT.noteMode : SUPPORT_TICKET_TEXT.replyMode}
      </label>
      <p
        id={`${id}-hint`}
        className={cn('m-0 text-[12px]', isNote ? 'text-(--color-warn)' : 'ink-muted')}
      >
        {isNote ? SUPPORT_TICKET_TEXT.noteHint : SUPPORT_TICKET_TEXT.replyHint}
      </p>
      {!canReply ? (
        <p className="m-0 text-[12px] ink-muted">{SUPPORT_TICKET_TEXT.closedNoReply}</p>
      ) : null}
      <Textarea
        id={`${id}-text`}
        rows={4}
        maxLength={5000}
        value={text}
        placeholder={
          isNote ? SUPPORT_TICKET_TEXT.notePlaceholder : SUPPORT_TICKET_TEXT.replyPlaceholder
        }
        aria-describedby={`${id}-hint`}
        aria-invalid={error ? 'true' : undefined}
        className="min-h-[110px] bg-white py-[8px]"
        onChange={(event) => {
          setText(event.target.value);
          replyId.current = null;
        }}
      />
      {error ? (
        <p role="alert" className="m-0 text-[12px] text-(--color-err)">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          variant={isNote ? 'secondary' : 'primary'}
          loading={pending}
          disabled={pending || text.trim() === ''}
        >
          {isNote ? SUPPORT_TICKET_TEXT.addNote : SUPPORT_TICKET_TEXT.sendReply}
        </Button>
        {pending ? (
          <span role="status" className="sr-only">
            {SUPPORT_TICKET_TEXT.sending}
          </span>
        ) : null}
      </div>
    </form>
  );
}
