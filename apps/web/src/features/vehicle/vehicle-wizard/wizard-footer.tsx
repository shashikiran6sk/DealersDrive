'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';

import { VEHICLE_WIZARD_TEXT } from './vehicle-wizard.constants';
import { LinkPendingLabel } from '@/components/ui/link-pending';

export function WizardFooter({ first, cancelHref }: { first: boolean; cancelHref: string }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap items-center gap-[9px] border-t border-(--color-divider) pt-[16px] max-[480px]:[&>*]:w-full">
      {first ? (
        <Link href={cancelHref} className="relative btn btn-secondary">
          <LinkPendingLabel>{VEHICLE_WIZARD_TEXT.cancel}</LinkPendingLabel>
        </Link>
      ) : (
        <Button type="submit" name="intent" value="back" variant="secondary" disabled={pending}>
          {VEHICLE_WIZARD_TEXT.back}
        </Button>
      )}
      {first ? null : (
        <Button
          type="submit"
          name="intent"
          value="draft"
          variant="secondary"
          className="ml-auto max-[480px]:ml-0"
          disabled={pending}
        >
          {VEHICLE_WIZARD_TEXT.saveDraft}
        </Button>
      )}
      <Button
        type="submit"
        name="intent"
        value="continue"
        variant="primary"
        className={first ? 'ml-auto max-[480px]:ml-0' : undefined}
        loading={pending}
      >
        {VEHICLE_WIZARD_TEXT.continue}
      </Button>
    </div>
  );
}
