import { DealerVehicle } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  VEHICLE_WIZARD_TEXT,
  VehicleWizard,
  isWizardStep,
} from '@/features/vehicle/vehicle-wizard';
import { ApiError, apiGetParsed } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: VEHICLE_WIZARD_TEXT.editTitle };

export default async function EditVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string; saved?: string; submitted?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  let vehicle: DealerVehicle;
  try {
    vehicle = await apiGetParsed(DealerVehicle, `/v1/dealer/vehicles/${encodeURIComponent(id)}`, {
      revalidate: false,
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const step = isWizardStep(query.step) ? query.step : 'basics';

  return (
    <div className="flex max-w-[860px] flex-col gap-[18px] px-4 py-[22px] md:px-8 md:py-[30px]">
      <div>
        <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">{vehicle.title}</h1>
        <p className="mt-1 text-[13px] ink-muted">
          <span className="font-mono">{vehicle.registrationDisplay}</span>
          {vehicle.summary ? <span className="tnum"> · {vehicle.summary}</span> : null}
        </p>
      </div>
      <VehicleWizard
        step={step}
        vehicle={vehicle}
        saved={query.saved === '1'}
        submitted={query.submitted === '1'}
      />
    </div>
  );
}
