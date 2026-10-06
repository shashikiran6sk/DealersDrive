import { SalesVehiclesResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SALES_VEHICLE_TEXT } from '@/features/sales/sales-vehicle-list';
import { VEHICLE_WIZARD_TEXT, VehicleWizard } from '@/features/vehicle/vehicle-wizard';
import { ApiError, apiGetParsed } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: VEHICLE_WIZARD_TEXT.pageTitle };

export default async function NewAssistedVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let listings: SalesVehiclesResponse;
  try {
    listings = await apiGetParsed(
      SalesVehiclesResponse,
      `/v1/sales/dealers/${encodeURIComponent(id)}/vehicles`,
      { revalidate: false },
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
  if (!listings.canCreate) notFound();

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-[18px] p-4 md:p-8">
      <div>
        <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">
          {VEHICLE_WIZARD_TEXT.pageTitle}
        </h1>
        <p className="mt-1 max-w-[62ch] text-[13px] ink-muted">{SALES_VEHICLE_TEXT.newIntro}</p>
      </div>
      <VehicleWizard
        step="registration"
        vehicle={null}
        salesDealerId={id}
        cancelHref={`/sales/dealers/${id}`}
      />
    </div>
  );
}
