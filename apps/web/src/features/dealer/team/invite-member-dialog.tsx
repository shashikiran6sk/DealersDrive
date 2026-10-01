'use client';

import { useState, useTransition, type FormEvent } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';

import { DEFAULT_INVITE_ROLE, ROLE_DESCRIPTIONS, ROLE_OPTIONS, TEAM_TEXT } from './team.constants';
import type { InviteMemberDialogProps } from './team.types';

const FORM_ID = 'invite-member-form';
const PHONE_ID = 'invite-member-phone';

export function InviteMemberDialog({ onInvite }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<string>(DEFAULT_INVITE_ROLE);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setPhone('');
      setRole(DEFAULT_INVITE_ROLE);
      setMessage(undefined);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await onInvite(phone, role);
      if (result.ok) reset(false);
      else setMessage(result.message);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={reset}
      title={TEAM_TEXT.inviteTitle}
      description={TEAM_TEXT.inviteDescription}
      trigger={<Button variant="primary">{TEAM_TEXT.invite}</Button>}
      footer={
        <>
          <Button variant="secondary" onClick={() => reset(false)} disabled={pending}>
            {TEAM_TEXT.cancel}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={FORM_ID}
            loading={pending}
            disabled={phone.trim().length < 10}
          >
            {TEAM_TEXT.sendInvite}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} className="flex flex-col gap-[16px]" onSubmit={submit}>
        <Field id={PHONE_ID} label={TEAM_TEXT.phoneLabel} hint={TEAM_TEXT.phoneHint}>
          <Input
            id={PHONE_ID}
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            className="tnum"
            placeholder={TEAM_TEXT.phonePlaceholder}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>

        <fieldset className="m-0 flex flex-col gap-[8px] border-0 p-0">
          <legend className="mb-[6px] text-[13px] font-bold">{TEAM_TEXT.roleLabel}</legend>
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-[10px] rounded-[10px] border border-(--color-divider) p-[12px] has-[:checked]:border-(--color-ink)"
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
                className="mt-[3px] accent-(--color-ink)"
              />
              <span className="flex flex-col">
                <span className="text-[14px] font-bold">{option.label}</span>
                <span className="text-[12px] ink-muted">{ROLE_DESCRIPTIONS[option.value]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {message ? <Banner tone="err">{message}</Banner> : null}
      </form>
    </Dialog>
  );
}
