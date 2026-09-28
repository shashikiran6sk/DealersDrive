import { ButtonLink } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';

import { AVAILABILITY_NOTICE_TEXT } from './availability-notice.constants';

export function AvailabilityNotice() {
  return (
    <div className="flex flex-col gap-[10px]">
      <Banner tone="warn" title={AVAILABILITY_NOTICE_TEXT.reservedTitle}>
        {AVAILABILITY_NOTICE_TEXT.reservedBody}
      </Banner>
      <ButtonLink href={AVAILABILITY_NOTICE_TEXT.browseHref} variant="secondary" block>
        {AVAILABILITY_NOTICE_TEXT.browse}
      </ButtonLink>
    </div>
  );
}
