import { PublicVehicleDetail } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Plate } from '@/components/ui/primitives';
import { PriceBlock } from '@/components/vehicle/price-block';
import { SpecList } from '@/components/vehicle/spec-list';
import { VdpDealerCard } from '@/components/vehicle/vdp-dealer-card';
import { VehicleGallery } from '@/components/vehicle/vehicle-gallery';
import { ApiError, apiGetParsed } from '@/lib/api';
import { VEHICLES_TAG, vehicleTag } from '@/lib/cache-tags';
import { seoMetadata } from '@/lib/seo';

import { VEHICLE_PAGE_TEXT } from './vehicle-page.constants';

export const revalidate = 60;

async function loadVehicle(slug: string): Promise<PublicVehicleDetail | null> {
  try {
    return await apiGetParsed(PublicVehicleDetail, `/v1/vehicles/${encodeURIComponent(slug)}`, {
      revalidate: 60,
      tags: [VEHICLES_TAG, vehicleTag(slug)],
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await loadVehicle(slug);
  if (!vehicle) return { title: VEHICLE_PAGE_TEXT.notFoundTitle };

  return {
    title: VEHICLE_PAGE_TEXT.metaTitle(vehicle.title, vehicle.priceLabel),
    description: VEHICLE_PAGE_TEXT.metaDescription(
      vehicle.title,
      vehicle.summary,
      vehicle.dealer.name,
    ),
    ...seoMetadata({ kind: 'resolved', canonical: `/car/${vehicle.slug}`, isIndexable: true }),
  };
}

export default async function VehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = await loadVehicle(slug);
  if (!vehicle) notFound();

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-[22px] pb-[60px]">
      <Link href="/cars" className="btn btn-ghost mb-[14px]">
        {VEHICLE_PAGE_TEXT.back}
      </Link>

      <div className="grid gap-[30px] lg:grid-cols-[1.35fr_1fr]">
        <div className="flex min-w-0 flex-col gap-[26px]">
          <VehicleGallery
            title={vehicle.title}
            images={vehicle.images}
            primaryIndex={vehicle.primaryIndex}
          />

          <section aria-labelledby="specs-heading" className="flex flex-col gap-[10px]">
            <h2 id="specs-heading" className="text-[20px]">
              {VEHICLE_PAGE_TEXT.specifications}
            </h2>
            <SpecList specs={vehicle.specs} />
          </section>

          {vehicle.description ? (
            <section aria-labelledby="description-heading" className="flex flex-col gap-[10px]">
              <h2 id="description-heading" className="text-[20px]">
                {VEHICLE_PAGE_TEXT.description}
              </h2>
              <p className="max-w-[66ch] text-[14px] leading-[1.65] whitespace-pre-line ink-body">
                {vehicle.description}
              </p>
            </section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-[16px] self-start lg:sticky lg:rail-top">
          <div className="flex flex-col gap-[6px]">
            {vehicle.year ? <Plate className="self-start">{vehicle.year}</Plate> : null}
            <h1 className="text-[28px] leading-[1.15]">{vehicle.title}</h1>
            {vehicle.summary ? (
              <p className="text-[13px] ink-secondary tnum">{vehicle.summary}</p>
            ) : null}
            {vehicle.publishedLabel ? (
              <p className="text-[12px] ink-subtle">{vehicle.publishedLabel}</p>
            ) : null}
          </div>
          <PriceBlock
            priceLabel={vehicle.priceLabel}
            negotiabilityLabel={vehicle.negotiabilityLabel}
          />
          <VdpDealerCard dealer={vehicle.dealer} />
        </aside>
      </div>
    </div>
  );
}
