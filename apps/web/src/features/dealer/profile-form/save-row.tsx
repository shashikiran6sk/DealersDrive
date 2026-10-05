'use client';

import { Button } from '@/components/ui/button';

import { PROFILE_FORM_TEXT } from './profile-form.constants';

export function SaveRow({ pending }: { pending: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" variant="primary" size="md" loading={pending} className="min-w-[160px]">
        {PROFILE_FORM_TEXT.save}
      </Button>
      <span className="text-[12px] ink-subtle">{PROFILE_FORM_TEXT.saveNote}</span>
    </div>
  );
}
