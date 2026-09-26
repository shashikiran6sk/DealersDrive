import type { Metadata } from 'next';

import { VEHICLE_WIZARD_TEXT, VehicleWizard } from '@/features/vehicle/vehicle-wizard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: VEHICLE_WIZARD_TEXT.pageTitle };

export default function NewVehiclePage() {
  return (
    <div className="flex max-w-[860px] flex-col gap-[18px] p-[22px]">
      <div>
        <h1 className="text-[28px]">{VEHICLE_WIZARD_TEXT.pageTitle}</h1>
        <p className="mt-1 max-w-[62ch] text-[13px] ink-muted">{VEHICLE_WIZARD_TEXT.intro}</p>
      </div>
      <VehicleWizard step="registration" vehicle={null} />
    </div>
  );
}
