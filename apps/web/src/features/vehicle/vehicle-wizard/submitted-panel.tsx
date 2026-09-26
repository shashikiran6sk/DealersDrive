import { ButtonLink } from '@/components/ui/button';
import { Blueprint, StatusTag } from '@/components/ui/primitives';

import { VEHICLE_WIZARD_TEXT } from './vehicle-wizard.constants';

export function SubmittedPanel({ doneHref }: { doneHref: string }) {
  return (
    <Blueprint className="flex max-w-[640px] flex-col items-start gap-[12px] bg-white p-[28px]">
      <StatusTag tone="warn">{VEHICLE_WIZARD_TEXT.submittedTag}</StatusTag>
      <h2 className="text-[29px] leading-[1.1]">{VEHICLE_WIZARD_TEXT.submittedTitle}</h2>
      <p className="max-w-[62ch] text-[14px] ink-body">{VEHICLE_WIZARD_TEXT.submittedBody}</p>
      <ButtonLink href={doneHref} variant="primary">
        {VEHICLE_WIZARD_TEXT.viewInventory}
      </ButtonLink>
    </Blueprint>
  );
}
