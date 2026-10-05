'use client';

import {
  SUPPORT_STATUS_LABELS,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { updateTicketAction, type TicketChanges } from '@/features/admin/support-actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { SUPPORT_PRIORITY_OPTIONS, SUPPORT_TICKET_TEXT } from './support-ticket.constants';
import type { TicketControlsProps } from './support-ticket.types';

export function TicketControls({
  ticket,
  viewerId,
  save = updateTicketAction,
}: TicketControlsProps) {
  const id = useId();
  const router = useRouter();
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [assignee, setAssignee] = useState(ticket.assignee?.id ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useNavigationSafeAction();
  const inFlight = useRef(false);

  const viewerAssignable =
    viewerId !== null && ticket.assignees.some((person) => person.id === viewerId);

  function changes(): TicketChanges {
    const next: TicketChanges = {};
    if (status !== ticket.status) next.status = status;
    if (priority !== ticket.priority) next.priority = priority;
    if (assignee !== (ticket.assignee?.id ?? ''))
      next.assignedAdminId = assignee === '' ? null : assignee;
    return next;
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-[12px]"
      onSubmit={(event) => {
        event.preventDefault();
        const next = changes();
        if (Object.keys(next).length === 0) {
          setMessage({ ok: true, text: SUPPORT_TICKET_TEXT.nothingChanged });
          return;
        }
        if (inFlight.current) return;
        inFlight.current = true;
        setMessage(null);
        startTransition(async () => {
          const result = await save(ticket.id, next);
          inFlight.current = false;
          setMessage(
            result.ok
              ? { ok: true, text: SUPPORT_TICKET_TEXT.saved }
              : { ok: false, text: result.message },
          );
          router.refresh();
        });
      }}
    >
      <div className="field">
        <label htmlFor={`${id}-status`}>{SUPPORT_TICKET_TEXT.status}</label>
        <Select
          id={`${id}-status`}
          value={status}
          disabled={ticket.transitions.length === 0}
          onChange={(event) => {
            const parsed = SupportTicketStatus.safeParse(event.target.value);
            if (parsed.success) setStatus(parsed.data);
          }}
        >
          <option value={ticket.status}>
            {SUPPORT_TICKET_TEXT.currentStatus(ticket.statusLabel)}
          </option>
          {ticket.transitions.map((option) => (
            <option key={option} value={option}>
              {SUPPORT_STATUS_LABELS[option]}
            </option>
          ))}
        </Select>
        {ticket.transitions.length === 0 ? (
          <p className="mt-1 text-[11px] ink-subtle">{SUPPORT_TICKET_TEXT.closedFinal}</p>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={`${id}-priority`}>{SUPPORT_TICKET_TEXT.priority}</label>
        <Select
          id={`${id}-priority`}
          value={priority}
          onChange={(event) => {
            const parsed = SupportTicketPriority.safeParse(event.target.value);
            if (parsed.success) setPriority(parsed.data);
          }}
        >
          {SUPPORT_PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="field">
        <label htmlFor={`${id}-assignee`}>{SUPPORT_TICKET_TEXT.assignee}</label>
        <Select
          id={`${id}-assignee`}
          value={assignee}
          onChange={(event) => {
            setAssignee(event.target.value);
          }}
        >
          <option value="">{SUPPORT_TICKET_TEXT.unassigned}</option>
          {ticket.assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </Select>
        {viewerAssignable && assignee !== viewerId ? (
          <button
            type="button"
            className="mt-[6px] self-start text-[12px] font-bold underline underline-offset-2"
            onClick={() => {
              setAssignee(viewerId ?? '');
            }}
          >
            {SUPPORT_TICKET_TEXT.assignToMe}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-[10px]">
        <Button type="submit" variant="primary" loading={pending}>
          {SUPPORT_TICKET_TEXT.save}
        </Button>
        {message ? (
          <p
            role={message.ok ? 'status' : 'alert'}
            className={
              message.ok ? 'm-0 text-[12px] ink-muted' : 'm-0 text-[12px] text-(--color-err)'
            }
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
