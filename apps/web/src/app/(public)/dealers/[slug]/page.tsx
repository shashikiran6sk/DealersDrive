import { PublicVehiclesResponse, type DealerPublicProfile } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DealerInventory, placeOf } from '@/components/dealers/dealer-inventory';
import { LocationCard } from '@/components/dealers/location-card';
import { JsonLd } from '@/components/seo/json-ld';
import { Blueprint, ImageSlot, LogoTile, Plate, Tag } from '@/components/ui/primitives';
import { ApiError, apiGet, apiGetParsed, qs } from '@/lib/api';
import { dealerTag, DEALERS_TAG, VEHICLES_TAG } from '@/lib/cache-tags';
import {
  BREADCRUMB_TEXT,
  breadcrumbSchema,
  dealerPath,
  dealerSchema,
  directoryPath,
  directoryView,
  isIndexableView,
  pageMetadata,
} from '@/lib/seo';
import type { SearchParamsInput } from '@/lib/url';
import { readVehicleSearch, type VehicleSearchParams } from '@/lib/vehicle-search';

import { DEALER_PAGE_TEXT } from './dealer-page.constants';

export const revalidate = 600;

async function loadDealer(slug: string): Promise<DealerPublicProfile | null> {
  try {
    return await apiGet<DealerPublicProfile>(`/v1/dealers/${encodeURIComponent(slug)}`, {
      revalidate: 600,
      tags: [dealerTag(slug), DEALERS_TAG],
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

async function loadInventory(
  slug: string,
  params: VehicleSearchParams,
): Promise<PublicVehiclesResponse | null> {
  try {
    return await apiGetParsed(
      PublicVehiclesResponse,
      `/v1/dealers/${encodeURIComponent(slug)}/vehicles${qs(params)}`,
      { revalidate: 60, tags: [dealerTag(slug), VEHICLES_TAG] },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

function liveCars(dealer: DealerPublicProfile): number | undefined {
  const value = Number(dealer.stats.find((stat) => stat.key === 'cars')?.value);
  return Number.isInteger(value) ? value : undefined;
}

function placeNameOf(dealer: DealerPublicProfile): string | null {
  return placeOf([dealer.address.city, dealer.address.district, dealer.address.state]);
}

function canonicalOf(
  dealer: DealerPublicProfile,
  search: VehicleSearchParams,
): {
  canonical: string;
  isIndexable: boolean;
} {
  const view = directoryView(search, false);
  const base = dealerPath(dealer.slug);
  return isIndexableView(view)
    ? { canonical: directoryPath(base, undefined, view.page), isIndexable: dealer.seo.isIndexable }
    : { canonical: base, isIndexable: false };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<SearchParamsInput>;
}): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const dealer = await loadDealer(slug);
  if (!dealer) return { title: DEALER_PAGE_TEXT.notFoundTitle };

  return pageMetadata({
    title: { absolute: dealer.seo.title },
    description: DEALER_PAGE_TEXT.metaDescription({
      brandName: dealer.brandName,
      tagline: dealer.tagline,
      place: placeNameOf(dealer),
      isVerified: dealer.isVerified,
    }),
    route: { kind: 'resolved', ...canonicalOf(dealer, readVehicleSearch(query, 'dealer')) },
    ...(dealer.coverUrl
      ? { images: [{ url: dealer.coverUrl, alt: DEALER_PAGE_TEXT.coverAlt(dealer.brandName) }] }
      : {}),
  });
}

export default async function DealerPortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const search = readVehicleSearch(query, 'dealer');
  const [dealer, inventory] = await Promise.all([loadDealer(slug), loadInventory(slug, search)]);
  if (!dealer || !inventory) notFound();

  return (
    <div>
      <JsonLd
        nodes={[
          dealerSchema(dealer),
          breadcrumbSchema([
            { name: BREADCRUMB_TEXT.home, path: '/' },
            { name: BREADCRUMB_TEXT.dealers, path: '/dealers' },
            { name: dealer.brandName, path: dealerPath(dealer.slug) },
          ]),
        ]}
      />

      <div className="border-b border-(--color-divider) bg-white">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 pt-[22px]">
          <Link href="/dealers" className="btn btn-ghost mb-[14px]">
            ← Back to dealers
          </Link>
        </div>

        <div className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-[18px] px-6 pb-[20px]">
          <LogoTile
            initials={dealer.initials}
            size={78}
            className="max-md:h-[60px] max-md:w-[60px]"
          />

          <div className="min-w-[260px] flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] leading-[1.1] tracking-[-0.035em] sm:text-[34px]">
                {dealer.brandName}
              </h1>
              {dealer.isVerified ? <Plate size="chip">VERIFIED DEALER</Plate> : null}
            </div>
            {dealer.tagline ? (
              <p className="mt-[8px] max-w-[62ch] text-[16px] font-medium leading-[1.5]">
                {dealer.tagline}
              </p>
            ) : null}
            {dealer.address.full ? (
              <p className="mt-[6px] text-[14px] ink-secondary">{dealer.address.full}</p>
            ) : null}
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 pb-[20px]">
          <Blueprint className="h-[440px] bg-(--color-surface) max-lg:h-[340px] max-md:h-[240px]">
            {dealer.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dealer.coverUrl}
                alt={DEALER_PAGE_TEXT.coverAlt(dealer.brandName)}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageSlot label="Dealership frontage / yard photo" />
            )}
          </Blueprint>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-4 px-6 pt-6 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        <section className="card p-[18px]">
          <h2 className="eyebrow">Dealership details</h2>

          <dl className="border-t border-(--color-divider)">
            {detailRows(dealer).map((row) => (
              <div
                key={row.key}
                className="flex justify-between gap-4 border-b border-(--color-rule) py-[11px] text-[14px] last:border-b-0"
              >
                <dt className="ink-muted">{row.label}</dt>
                <dd className={row.mono ? 'font-mono' : 'font-semibold'}>{row.value}</dd>
              </div>
            ))}
          </dl>

          {dealer.services.length > 0 ? (
            <div className="mt-auto flex flex-wrap gap-[6px] border-t border-(--color-divider) pt-[10px]">
              {dealer.services.map((service) => (
                <Tag key={service} className="text-[11px]">
                  {service}
                </Tag>
              ))}
            </div>
          ) : null}
        </section>

        <LocationCard address={dealer.address} brandName={dealer.brandName} />
      </div>

      <DealerInventory
        dealerSlug={dealer.slug}
        brandName={dealer.brandName}
        inventory={inventory}
        params={search}
        location={placeNameOf(dealer)}
        {...(liveCars(dealer) === undefined ? {} : { liveTotal: liveCars(dealer) })}
      />
    </div>
  );
}

type DetailRow = DealerPublicProfile['contact'][number];

function detailRows(dealer: DealerPublicProfile): DetailRow[] {
  return [
    ...dealer.contact,
    ...dealer.stats
      .filter((stat) => stat.key !== 'location')
      .map((stat) => ({ key: stat.key, label: stat.label, value: stat.value || '—' })),
  ];
}
