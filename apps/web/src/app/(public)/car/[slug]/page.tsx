import { PublicVehicleDetail, SimilarVehiclesResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache, Suspense } from 'react';

import { Plate } from '@/components/ui/primitives';
import { AvailabilityNotice } from '@/components/vehicle/availability-notice';
import { PriceBlock } from '@/components/vehicle/price-block';
import { SaveButton } from '@/components/vehicle/save-button';
import { SimilarVehicles } from '@/components/vehicle/similar-vehicles';
import { SpecList } from '@/components/vehicle/spec-list';
import { VdpDealerCard } from '@/components/vehicle/vdp-dealer-card';
import { AvailabilityBadge, availabilityLabel } from '@/components/vehicle/vehicle-card';
import { VehicleGallery } from '@/components/vehicle/vehicle-gallery';
import { VehicleName } from '@/components/vehicle/vehicle-name';
import { JsonLd } from '@/components/seo/json-ld';
import { EnquireFromUrl, EnquiryPanel } from '@/features/enquiry/enquiry-panel';
import { apiGetParsed } from '@/lib/api';
import { cachedLookup } from '@/lib/cached-lookup';
import { VEHICLES_TAG, vehicleTag } from '@/lib/cache-tags';
import { isMissingResource } from '@/lib/errors';
import {
  BREADCRUMB_TEXT,
  breadcrumbSchema,
  pageMetadata,
  seoMetadata,
  vehiclePath,
  vehicleSchema,
} from '@/lib/seo';
import { logger } from '@/lib/logger';

import { VEHICLE_PAGE_TEXT } from './vehicle-page.constants';

export const revalidate = 60;

const VEHICLE_CACHE = (slug: string) => ({
  revalidate: 60,
  tags: [VEHICLES_TAG, vehicleTag(slug)],
});

const loadVehicle = cache((slug: string): Promise<PublicVehicleDetail | null> =>
  cachedLookup(
    ['public-vehicle', slug],
    async () => {
      try {
        return await apiGetParsed(
          PublicVehicleDetail,
          `/v1/vehicles/${encodeURIComponent(slug)}`,
          VEHICLE_CACHE(slug),
        );
      } catch (error) {
        if (isMissingResource(error, { invalidIdentifier: true })) return null;
        throw error;
      }
    },
    VEHICLE_CACHE(slug),
  ),
);

async function loadSimilar(slug: string): Promise<SimilarVehiclesResponse['data']> {
  try {
    const { data } = await apiGetParsed(
      SimilarVehiclesResponse,
      `/v1/vehicles/${encodeURIComponent(slug)}/similar`,
      { revalidate: 60, tags: [VEHICLES_TAG, vehicleTag(slug)] },
    );
    return data;
  } catch (error) {
    logger.warn('vehicle.similar_unavailable', { slug, error });
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await loadVehicle(slug).catch(() => undefined);
  if (vehicle === undefined) return seoMetadata({ kind: 'noindex' });
  if (!vehicle) return { title: VEHICLE_PAGE_TEXT.notFoundTitle };

  const primary = vehicle.images[vehicle.primaryIndex] ?? vehicle.images[0];
  return pageMetadata({
    title: VEHICLE_PAGE_TEXT.metaTitle(vehicle.title, vehicle.dealer.city),
    description: VEHICLE_PAGE_TEXT.metaDescription({
      title: vehicle.title,
      place: vehicle.dealer.location,
      priceLabel: vehicle.priceLabel,
      summary: vehicle.summary,
      dealerName: vehicle.dealer.name,
      dealerVerified: vehicle.dealer.isVerified,
      reserved: vehicle.availability === 'RESERVED',
    }),
    route: {
      kind: 'resolved',
      canonical: vehiclePath(vehicle.slug),
      isIndexable: vehicle.availability === 'AVAILABLE' || vehicle.availability === 'RESERVED',
    },
    ...(primary ? { images: [{ url: primary.url, alt: primary.alt }] } : {}),
  });
}

export default async function VehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = await loadVehicle(slug);
  if (!vehicle) notFound();
  const available = vehicle.availability === 'AVAILABLE';
  const similar = await loadSimilar(vehicle.slug);

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-[24px] pb-[88px] sm:px-6 lg:pb-[64px]">
      <JsonLd
        nodes={[
          vehicleSchema(vehicle),
          breadcrumbSchema([
            { name: BREADCRUMB_TEXT.home, path: '/' },
            { name: BREADCRUMB_TEXT.cars, path: '/cars' },
            { name: vehicle.title, path: vehiclePath(vehicle.slug) },
          ]),
        ]}
      />
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
            <h2 id="specs-heading" className="text-[22px]">
              {VEHICLE_PAGE_TEXT.specifications}
            </h2>
            <SpecList specs={vehicle.specs} />
          </section>

          {vehicle.description ? (
            <section aria-labelledby="description-heading" className="flex flex-col gap-[10px]">
              <h2 id="description-heading" className="text-[22px]">
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
            <div className="relative flex items-center gap-[8px]">
              {vehicle.year ? <Plate className="self-start">{vehicle.year}</Plate> : null}
              {available ? null : (
                <AvailabilityBadge
                  label={availabilityLabel(vehicle.availability)}
                  className="static"
                />
              )}
            </div>
            <h1 className="text-[26px] leading-[1.15] tracking-[-0.035em] sm:text-[30px]">
              <VehicleName title={vehicle.title} year={vehicle.year} />
            </h1>
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
          {available ? (
            <Suspense
              fallback={
                <EnquiryPanel listingSlug={vehicle.slug} dealerName={vehicle.dealer.name} />
              }
            >
              <EnquireFromUrl listingSlug={vehicle.slug} dealerName={vehicle.dealer.name} />
            </Suspense>
          ) : (
            <AvailabilityNotice />
          )}
          <SaveButton
            slug={vehicle.slug}
            title={vehicle.title}
            variant="labelled"
            className="w-full"
          />
          <VdpDealerCard dealer={vehicle.dealer} />
        </aside>
      </div>

      {similar.length > 0 ? (
        <div className="mt-[44px]">
          <SimilarVehicles vehicles={similar} />
        </div>
      ) : null}
    </div>
  );
}
