import type { CatalogBundle, DealerVehicleDto, PublicConfig } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Blueprint, StatusTag } from '@/components/ui/primitives';
import { VehicleWizard } from '@/features/vehicle/wizard';
import { toStep } from '@/features/vehicle/steps';
import { ApiError, apiGet } from '@/lib/api';
import type { SearchParamsInput } from '@/lib/url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Edit vehicle' };

export default async function EditVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  let vehicle: DealerVehicleDto;
  try {
    vehicle = await apiGet<DealerVehicleDto>(`/v1/dealer/vehicles/${id}`, { revalidate: false });
  } catch (error) {
    // Another dealer's vehicle 404s upstream. That is the tenant boundary
    // doing its job, and it must look identical to a vehicle that never
    // existed — a 403 here would confirm the id is real (§5.2).
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const [catalog, config] = await Promise.all([
    apiGet<CatalogBundle>('/v1/catalog/bundle', { revalidate: 3600 }),
    apiGet<PublicConfig>('/v1/config/public', { revalidate: 300 }),
  ]);

  const submitted = query.submitted === '1';

  // DESIGN-SPEC §3.14 — the Submitted screen, after a successful submit.
  if (submitted && vehicle.displayStatus === 'PENDING') {
    return (
      <div className="mx-auto max-w-[640px] px-[22px] py-10">
        <Blueprint className="bg-white p-7">
          <StatusTag tone="warn">Pending approval</StatusTag>
          <h1 className="mt-3 text-[29px] leading-[1.1]">{vehicle.title} is with our reviewers</h1>
          <p className="mt-[10px] text-[14px] leading-[1.6] ink-secondary">
            One credit is held while we check the photos, the price and the odometer reading. It is
            consumed when the listing goes live, and returned in full if we reject it. Most
            listings are decided within a few hours.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/dealer/inventory" className="btn btn-primary">
              View inventory
            </Link>
            <Link href="/admin/listings" className="btn btn-secondary">
              Open admin queue (demo)
            </Link>
          </div>
        </Blueprint>
      </div>
    );
  }

  return (
    <VehicleWizard
      vehicle={vehicle}
      catalog={catalog}
      step={toStep(typeof query.step === 'string' ? query.step : undefined)}
      minPhotos={config.minPhotosPerListing}
    />
  );
}
