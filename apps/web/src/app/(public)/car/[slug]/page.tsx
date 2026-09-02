import type { VehicleCard as VehicleCardDto, VehicleDetail } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Blueprint, LogoTile, Plate, Tag } from '@/components/ui/primitives';
import { VehicleGallery } from '@/components/vehicle/gallery';
import { VehicleCard } from '@/components/vehicle/vehicle-card';
import { VdpCtaStack } from '@/components/vehicle/vdp-cta';
import { ReportSummary } from '@/features/report/report-summary';
import { EnquiryForm } from '@/features/enquiry/enquiry-form';
import { ApiError, apiGet } from '@/lib/api';
import { serverConfig } from '@/lib/config';
import { seoMetadata } from '@/lib/seo';

/** RSC + ISR 60s. The page is SEO-critical and entirely public (§15.1, §18). */
export const revalidate = 60;

const ENQUIRY_FORM_ID = 'enquire';

async function loadVehicle(slug: string): Promise<VehicleDetail | null> {
  try {
    return await apiGet<VehicleDetail>(`/v1/vehicles/${encodeURIComponent(slug)}`, {
      revalidate: 60,
    });
  } catch (error) {
    // A5 404s when the listing is not APPROVED, the dealer is not ACTIVE, or the
    // vehicle is soft-deleted. All three are "this car is not for sale here".
    if (error instanceof ApiError && error.status === 404) return null;
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
  if (!vehicle) return { title: 'Car not found' };

  return {
    // `absolute`: the API composes the whole title, brand suffix included, so
    // the root template must not append a second one.
    title: { absolute: vehicle.seo.title },
    description: vehicle.seo.description,
    // A5 already knows the sold-more-than-30-days fact this layer does not, so
    // its answer is what the one policy resolver is handed (§17.2).
    ...seoMetadata({
      kind: 'resolved',
      canonical: vehicle.seo.canonical,
      isIndexable: vehicle.seo.isIndexable,
    }),
    openGraph: {
      type: 'website',
      title: vehicle.seo.title,
      description: vehicle.seo.description,
      url: vehicle.seo.canonical,
      ...(vehicle.photos[0] ? { images: [{ url: vehicle.photos[0].url }] } : {}),
    },
  };
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = await loadVehicle(slug);
  if (!vehicle) notFound();

  // A6 is a nice-to-have below the fold: if it fails the car page still sells
  // the car, so it is caught rather than allowed to take the route down.
  const similar = await apiGet<{ data: VehicleCardDto[] }>(
    `/v1/vehicles/${vehicle.id}/similar?limit=4`,
    { revalidate: 300 },
  ).catch(() => null);

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-[60px] pt-[22px]">
      <VehicleJsonLd vehicle={vehicle} />

      <Link href="/cars" className="btn btn-ghost mb-[14px]">
        ← Back to results
      </Link>

      <div className="grid gap-[30px] lg:[grid-template-columns:1.35fr_1fr]">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="min-w-0">
          <VehicleGallery
            photos={vehicle.photos}
            title={`${vehicle.year} ${vehicle.title}`}
            photoCountLabel={vehicle.photoCountLabel}
          />

          <section className="mt-[34px]">
            <h3 className="mb-3 text-[21px]">Specifications</h3>
            <dl className="border border-(--color-divider) bg-white">
              {vehicle.specs.map((spec) => (
                <div
                  key={spec.key}
                  className="flex justify-between gap-4 border-b border-[color-mix(in_srgb,var(--color-ink)_8%,transparent)] px-[14px] py-[11px] text-[13px] last:border-b-0"
                >
                  <dt className="ink-muted">{spec.label}</dt>
                  <dd className="font-medium tnum">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/*
            Directly under the specifications and above features: a buyer who
            has just read the odometer and the owner count is exactly where a
            records check does work. Below the fold it would be decoration.

            `report` is null for every listing added before this feature and
            whenever `feature.vehicleReport` is off — an absent report renders
            nothing at all, because a missing check is not a finding.
          */}
          {vehicle.report ? (
            <section className="mt-[30px]">
              <ReportSummary report={vehicle.report} />
            </section>
          ) : null}

          {vehicle.features.length > 0 ? (
            <section className="mt-[30px]">
              <h3 className="mb-3 text-[21px]">Features</h3>
              <ul className="flex flex-wrap gap-[7px]">
                {vehicle.features.map((feature) => (
                  <li key={feature}>
                    <Tag className="px-[11px] py-[5px] text-[12px]">{feature}</Tag>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {vehicle.description ? (
            <section className="mt-[30px]">
              <h3 className="mb-[10px] text-[21px]">Dealer description</h3>
              <p className="max-w-[66ch] text-[14px] leading-[1.65] text-[color-mix(in_srgb,var(--color-ink)_75%,transparent)] text-pretty">
                {vehicle.description}
              </p>
            </section>
          ) : null}

          <EnquiryForm
            id={ENQUIRY_FORM_ID}
            source="LISTING_PAGE"
            vehicleId={vehicle.id}
            dealerBrandName={vehicle.dealer.brandName}
          />
        </div>

        {/* ── Right column — sticky under the 58px header + 26px ───────── */}
        <div className="flex flex-col gap-4 self-start lg:sticky lg:top-[84px]">
          <div>
            <Plate className="mb-[10px]">{vehicle.year}</Plate>
            <h1 className="mt-2 text-[29px] leading-[1.1]">{vehicle.title}</h1>
            <div className="mt-[7px] text-[13px] ink-muted">{vehicle.summary}</div>
          </div>

          {/* PriceBlock/Plate — §2.11, VDP only. */}
          <Blueprint className="bg-white p-4">
            <div className="eyebrow">Dealer price</div>
            <div className="my-[3px] font-heading text-[36px] font-bold leading-[1.1] tnum">
              {vehicle.price.priceLabel}
            </div>
            <div className="text-[13px] ink-secondary tnum">
              {vehicle.price.emiLabel} · {vehicle.price.negotiableLabel}
            </div>
          </Blueprint>

          <VdpCtaStack
            vehicleId={vehicle.id}
            dealerBrandName={vehicle.dealer.brandName}
            formId={ENQUIRY_FORM_ID}
          />

          <div className="card gap-[11px] p-[10px]">
            <div className="flex items-center gap-[11px]">
              <LogoTile initials={vehicle.dealer.initials} size={42} />
              <div className="min-w-0 flex-1">
                <div className="font-heading text-[16px] font-semibold">
                  {vehicle.dealer.brandName}
                </div>
                <div className="text-[12px] ink-subtle tnum">{vehicle.dealer.carCountLabel}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-(--color-divider) pt-[10px]">
              {vehicle.dealer.isVerified ? (
                <Plate size="chip">VERIFIED DEALER</Plate>
              ) : (
                <span className="text-[11px] ink-subtle">Verification in progress</span>
              )}
              <Link
                href={`/dealers/${vehicle.dealer.slug}`}
                className="btn btn-ghost ml-auto text-[12px]"
              >
                View dealership →
              </Link>
            </div>
          </div>

          <p className="text-[12px] leading-[1.6] ink-faint">
            Dealers-Drive verifies dealer identity and business documents. The vehicle itself is
            owned, priced and warranted by the dealer.
          </p>
        </div>
      </div>

      {similar && similar.data.length > 0 ? (
        <section className="mt-[46px] border-t border-(--color-divider) pt-[26px]">
          <h2 className="mb-5 text-[28px]">Similar cars</h2>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(258px,1fr))]">
            {similar.data.map((item) => (
              <VehicleCard key={item.id} vehicle={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * `Vehicle` + `Offer` + `AutoDealer` + `BreadcrumbList` (ARCHITECTURE §17.3).
 *
 * Every value here is one the page also shows: a price in the markup that
 * differs from the price on screen is a manual-action risk, not a shortcut. The
 * dealer's phone is absent from this block as it is from every other public
 * byte (Rule 7).
 */
function VehicleJsonLd({ vehicle }: { vehicle: VehicleDetail }) {
  const { webBaseUrl } = serverConfig();
  const spec = (key: string): string | undefined =>
    vehicle.specs.find((entry) => entry.key === key)?.value;

  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Vehicle',
        name: `${vehicle.year} ${vehicle.title}`,
        url: vehicle.seo.canonical,
        vehicleModelDate: String(vehicle.year),
        brand: { '@type': 'Brand', name: vehicle.make.name },
        model: vehicle.model.name,
        ...(vehicle.variant ? { vehicleConfiguration: vehicle.variant.name } : {}),
        ...(spec('fuel') ? { fuelType: spec('fuel') } : {}),
        ...(spec('transmission') ? { vehicleTransmission: spec('transmission') } : {}),
        ...(spec('bodyType') ? { bodyType: spec('bodyType') } : {}),
        ...(spec('km')
          ? {
              mileageFromOdometer: {
                '@type': 'QuantitativeValue',
                value: spec('km')?.replace(/[^0-9]/g, ''),
                unitCode: 'KMT',
              },
            }
          : {}),
        ...(vehicle.description ? { description: vehicle.description } : {}),
        image: vehicle.photos.map((photo) => photo.url),
        offers: {
          '@type': 'Offer',
          // Paise are the store of record; schema.org wants a decimal amount.
          price: (vehicle.price.pricePaise / 100).toFixed(2),
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/UsedCondition',
          url: vehicle.seo.canonical,
          seller: {
            '@type': 'AutoDealer',
            name: vehicle.dealer.brandName,
            url: `${webBaseUrl}/dealers/${vehicle.dealer.slug}`,
            address: {
              '@type': 'PostalAddress',
              addressLocality: vehicle.dealer.city,
              addressRegion: 'Tamil Nadu',
              addressCountry: 'IN',
            },
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: webBaseUrl },
          { '@type': 'ListItem', position: 2, name: 'Used cars', item: `${webBaseUrl}/cars` },
          { '@type': 'ListItem', position: 3, name: vehicle.title, item: vehicle.seo.canonical },
        ],
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
