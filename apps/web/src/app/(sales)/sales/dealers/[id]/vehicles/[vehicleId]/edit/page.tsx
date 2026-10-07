import { DealerVehicle, SalesVehiclesResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SALES_VEHICLE_TEXT } from '@/features/sales/sales-vehicle-list';
import {
  VEHICLE_WIZARD_TEXT,
  VehicleWizard,
  isWizardStep,
} from '@/features/vehicle/vehicle-wizard';
import { ApiError, apiGetParsed } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: VEHICLE_WIZARD_TEXT.editTitle };

export default async function EditAssistedVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; vehicleId: string }>;
  searchParams: Promise<{ step?: string; saved?: string; submitted?: string }>;
}) {
  const [{ id, vehicleId }, query] = await Promise.all([params, searchParams]);
  const base = `/v1/sales/dealers/${encodeURIComponent(id)}/vehicles`;

  let vehicle: DealerVehicle;
  let listings: SalesVehiclesResponse;
  try {
    [vehicle, listings] = await Promise.all([
      apiGetParsed(DealerVehicle, `${base}/${encodeURIComponent(vehicleId)}`, {
        revalidate: false,
      }),
      apiGetParsed(SalesVehiclesResponse, base, { revalidate: false }),
    ]);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const step = isWizardStep(query.step) ? query.step : 'basics';

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-[18px] p-4 md:p-8">
      <div>
        <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">{vehicle.title}</h1>
        <p className="mt-1 text-[13px] ink-muted">
          <span className="font-mono">{vehicle.registrationDisplay}</span>
          {vehicle.summary ? <span className="tnum"> · {vehicle.summary}</span> : null}
        </p>
        <p className="mt-1 text-[12px] ink-muted">{SALES_VEHICLE_TEXT.onBehalf}</p>
      </div>
      <VehicleWizard
        step={step}
        vehicle={vehicle}
        saved={query.saved === '1'}
        submitted={query.submitted === '1'}
        salesDealerId={id}
        cancelHref={`/sales/dealers/${id}`}
        mayPublish={listings.dealerApproved}
      />
    </div>
  );
}
