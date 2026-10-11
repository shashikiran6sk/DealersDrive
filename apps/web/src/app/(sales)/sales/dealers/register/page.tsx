import type { PhoneOtpWidget } from '@dealers-drive/contracts';
import { AssistedDealerStart } from '@/features/sales/assisted-dealer-start';
import { apiGet } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Assist with basic registration' };
export default async function Page() {
  const widget = await apiGet<PhoneOtpWidget>('/v1/sales/phone/widget', { revalidate: false });
  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-5 p-4 md:p-8">
      <h1 className="text-[26px]">Register, verify, activate</h1>
      <AssistedDealerStart widget={widget} progressive />
    </div>
  );
}
