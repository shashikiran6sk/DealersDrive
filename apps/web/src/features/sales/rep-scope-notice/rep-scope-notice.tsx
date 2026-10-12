import { Banner } from '@/components/ui/primitives';
import { SALES_TEXT } from '@/features/sales/sales.constants';

export function RepScopeNotice({ businessComplete }: { businessComplete: boolean }) {
  return (
    <Banner
      tone={businessComplete ? 'ok' : 'warn'}
      title={businessComplete ? SALES_TEXT.repDoneTitle : SALES_TEXT.repPendingTitle}
    >
      <p>{SALES_TEXT.repScopeNote}</p>
    </Banner>
  );
}
