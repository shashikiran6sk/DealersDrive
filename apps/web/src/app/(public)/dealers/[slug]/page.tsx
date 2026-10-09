import { PublicVehiclesResponse, type DealerPublicProfile } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { DealerInventory, placeOf } from '@/components/dealers/dealer-inventory';
import { LocationCard } from '@/components/dealers/location-card';
import { SectionError } from '@/components/errors/section-error';
import { JsonLd } from '@/components/seo/json-ld';
import { LinkPendingLabel } from '@/components/ui/link-pending';
import { Blueprint, ImageSlot, LogoTile, Plate, Tag } from '@/components/ui/primitives';
import { apiGet, apiGetParsed, qs } from '@/lib/api';
import { cachedLookup } from '@/lib/cached-lookup';
import { dealerTag, DEALERS_TAG, VEHICLES_TAG } from '@/lib/cache-tags';
import { isMissingResource, isServerFailure } from '@/lib/errors';
import { logger } from '@/lib/logger';
import {
  BREADCRUMB_TEXT,
  breadcrumbSchema,
  dealerPath,
  dealerSchema,
  directoryPath,
  directoryView,
  isIndexableView,
  pageMetadata,
  seoMetadata,
} from '@/lib/seo';
import type { SearchParamsInput } from '@/lib/url';
import { readVehicleSearch, type VehicleSearchParams } from '@/lib/vehicle-search';

import { DEALER_PAGE_TEXT } from './dealer-page.constants';

export const revalidate = 600;

const DEALER_CACHE = (slug: string) => ({ revalidate: 600, tags: [dealerTag(slug), DEALERS_TAG] });

const loadDealer = cache((slug: string): Promise<DealerPublicProfile | null> =>
  cachedLookup(
    ['public-dealer', slug],
    async () => {
      try {
        return await apiGet<DealerPublicProfile>(
          `/v1/dealers/${encodeURIComponent(slug)}`,
          DEALER_CACHE(slug),
        );
      } catch (error) {
        if (isMissingResource(error)) return null;
        throw error;
      }
    },
    DEALER_CACHE(slug),
  ),
);

type InventoryResult =
  | { status: 'ready'; inventory: PublicVehiclesResponse }
  | { status: 'missing' }
  | { status: 'unavailable' };

async function loadInventory(slug: string, params: VehicleSearchParams): Promise<InventoryResult> {
  try {
    const inventory = await apiGetParsed(
      PublicVehiclesResponse,
      `/v1/dealers/${encodeURIComponent(slug)}/vehicles${qs(params)}`,
      { revalidate: 60, tags: [dealerTag(slug), VEHICLES_TAG] },
    );
    return { status: 'ready', inventory };
  } catch (error) {
    if (isMissingResource(error)) return { status: 'missing' };
    if (!isServerFailure(error)) throw error;
    logger.warn('dealer.inventory_unavailable', { slug, error });
    return { status: 'unavailable' };
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
  const dealer = await loadDealer(slug).catch(() => undefined);
  if (dealer === undefined) return seoMetadata({ kind: 'noindex' });
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
  if (!dealer || inventory.status === 'missing') notFound();

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
          <Link href="/dealers" className="relative btn btn-ghost mb-[14px]">
            <LinkPendingLabel>← Back to dealers</LinkPendingLabel>
          </Link>
        </div>

        <div className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-[18px] px-6 pb-[20px] max-md:grid max-md:grid-cols-[60px_minmax(0,1fr)] max-md:gap-x-3 max-md:gap-y-1.5 max-md:px-4">
          <LogoTile
            initials={dealer.initials}
            size={78}
            className="max-md:h-[60px]! max-md:w-[60px]! max-md:col-start-1 max-md:row-start-1"
          />

          <div className="min-w-[260px] flex-1 max-md:contents max-md:[overflow-wrap:anywhere]">
            <div className="flex flex-wrap items-center gap-3 max-md:col-start-2 max-md:row-start-1 max-md:gap-2">
              <h1 className="text-[28px] leading-[1.1] tracking-[-0.035em] max-sm:text-[22px] sm:text-[34px]">
                {dealer.brandName}
              </h1>
              {dealer.isVerified ? <Plate size="chip">VERIFIED DEALER</Plate> : null}
            </div>
            {dealer.tagline ? (
              <p className="mt-[8px] max-w-[62ch] text-[16px] font-medium leading-[1.5] max-md:col-span-2 max-md:row-start-3 max-md:mt-2">
                {dealer.tagline}
              </p>
            ) : null}
            {dealer.address.full ? (
              <p className="mt-[6px] text-[14px] ink-secondary max-md:col-span-2 max-md:row-start-2 max-md:mt-0">
                {dealer.address.full}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 pb-[20px]">
          <Blueprint className="h-[440px] bg-(--color-surface) max-lg:h-[340px] max-md:h-auto max-md:aspect-video">
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

      <div className="mx-auto grid max-w-[1280px] gap-4 px-6 pt-6 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))] max-md:[grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
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

      {inventory.status === 'ready' ? (
        <DealerInventory
          dealerSlug={dealer.slug}
          brandName={dealer.brandName}
          inventory={inventory.inventory}
          params={search}
          location={placeNameOf(dealer)}
          {...(liveCars(dealer) === undefined ? {} : { liveTotal: liveCars(dealer) })}
        />
      ) : (
        <SectionError
          title={DEALER_PAGE_TEXT.inventoryUnavailableTitle}
          message={DEALER_PAGE_TEXT.inventoryUnavailableMessage}
          className="mx-auto max-w-[1280px] px-4 pt-[26px] pb-[60px] sm:px-6"
        />
      )}
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
