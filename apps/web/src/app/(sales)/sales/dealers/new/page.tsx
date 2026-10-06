import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import type { Metadata } from 'next';

import { AssistedDealerStart } from '@/features/sales/assisted-dealer-start';
import { SALES_TEXT } from '@/features/sales/sales.constants';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Add a dealership' };

export default async function NewAssistedDealerPage() {
  const widget = await apiGet<PhoneOtpWidget>('/v1/sales/phone/widget', { revalidate: false });

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5 p-4 md:p-8">
      <div>
        <h1 className="text-[26px]">{SALES_TEXT.newHeading}</h1>
        <p className="mt-1 max-w-[70ch] text-[13px] ink-muted">{SALES_TEXT.newIntro}</p>
      </div>
      <AssistedDealerStart widget={widget} />
    </div>
  );
}
