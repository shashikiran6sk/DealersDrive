import type {
  DealerPublicProfile,
  DealerVehiclesResponse,
  FacetsResponse,
} from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { FilterPanel } from '@/components/search/filter-panel';
import { MobileFilterSheet, SearchToolbar } from '@/components/search/search-toolbar';
import { Blueprint, EmptyState, ImageSlot, LogoTile, Plate, Tag } from '@/components/ui/primitives';
import { VehicleCard } from '@/components/vehicle/vehicle-card';
import { RevealContactButton } from '@/components/vehicle/vdp-cta';
import { EnquiryForm } from '@/features/enquiry/enquiry-form';
import { ApiError, apiGet } from '@/lib/api';
import { serverConfig } from '@/lib/config';
import { seoMetadata } from '@/lib/seo';
import { buildSearchUrl, toApiQuery, type SearchParamsInput } from '@/lib/url';

/** RSC + ISR 10 min — SEO (ARCHITECTURE §15.1). */
export const revalidate = 600;

const ENQUIRY_FORM_ID = 'enquire-dealer';

/** §3.6 — Budget, Fuel, Body type, Transmission. No dealer group in a portfolio. */
const PORTFOLIO_FILTER_GROUPS = ['fuel', 'bodyType', 'transmission'] as const;

async function loadDealer(slug: string): Promise<DealerPublicProfile | null> {
  try {
    return await apiGet<DealerPublicProfile>(`/v1/dealers/${encodeURIComponent(slug)}`, {
      revalidate: 600,
    });
  } catch (error) {
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
  const dealer = await loadDealer(slug);
  if (!dealer) return { title: 'Dealership not found' };

  return {
    title: { absolute: dealer.seo.title },
    description:
      dealer.about ??
      `${dealer.brandName} is a verified independent used-car dealership in ${dealer.address.city}, Tamil Nadu.`,
    // A9 resolves indexability (ACTIVE and ≥1 live listing); the policy
    // function turns that into robots + canonical (§17.2).
    ...seoMetadata({
      kind: 'resolved',
      canonical: dealer.seo.canonical,
      isIndexable: dealer.seo.isIndexable,
    }),
  };
}

export default async function DealerPortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { slug } = await params;
  const dealer = await loadDealer(slug);
  if (!dealer) notFound();

  const query = toApiQuery(await searchParams);
  const encoded = new URLSearchParams(query).toString();
  const basePath = `/dealers/${dealer.slug}`;

  const [inventory, facets] = await Promise.all([
    apiGet<DealerVehiclesResponse>(
      `/v1/dealers/${dealer.slug}/vehicles${encoded ? `?${encoded}` : ''}`,
      { revalidate: 600 },
    ),
    apiGet<FacetsResponse>(
      `/v1/dealers/${dealer.slug}/facets${encoded ? `?${encoded}` : ''}`,
      { revalidate: 600 },
    ),
  ]);

  return (
    <div>
      <DealerJsonLd dealer={dealer} />

      {/* ── 1. Header block ─────────────────────────────────────────────── */}
      <div className="border-b border-(--color-divider) bg-white">
        <div className="mx-auto max-w-[1280px] px-6 pt-[22px]">
          <Link href="/dealers" className="btn btn-ghost mb-[14px]">
            ← Back to dealers
          </Link>
        </div>

        <Blueprint className="mx-auto h-[170px] max-w-[1280px] border-b-0 bg-(--color-surface) max-md:h-[120px]">
          {dealer.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dealer.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageSlot label="Dealership frontage / yard photo" />
          )}
        </Blueprint>

        <div className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-[18px] px-6 pb-[22px] pt-[18px]">
          <LogoTile
            initials={dealer.initials}
            size={78}
            className="relative z-[2] -mt-[46px] max-md:-mt-[34px] max-md:h-[60px] max-md:w-[60px]"
          />

          <div className="min-w-[260px] flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[34px] leading-[1.08]">{dealer.brandName}</h1>
              {dealer.isVerified ? <Plate size="chip">VERIFIED DEALER</Plate> : null}
            </div>
            <p className="mt-[6px] text-[14px] ink-secondary">{dealer.address.full}</p>
            <p className="mt-[3px] text-[13px] ink-subtle">{dealer.legalName}</p>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <a href={`#${ENQUIRY_FORM_ID}`} className="btn btn-primary">
              Enquire with dealer
            </a>
            {/* A7 is vehicle-scoped — it is the only endpoint that yields a
                number, and API-SPEC names this button as one of its two
                callers. So the reveal rides on a car this dealer has listed;
                with an empty yard there is nothing to reveal and the enquiry
                form is the whole path. */}
            {inventory.data[0] ? (
              <RevealContactButton
                vehicleId={inventory.data[0].id}
                dealerBrandName={dealer.brandName}
                label="Call dealership"
                className="w-[180px]"
              />
            ) : null}
          </div>
        </div>

        <div className="mx-auto grid max-w-[1280px] gap-3 px-6 pb-[22px] [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {dealer.stats.map((stat) => (
            <Blueprint key={stat.key} className="bg-(--color-surface) p-[14px]">
              <div className="eyebrow">{stat.label}</div>
              <div className="font-heading text-[28px] font-bold leading-[1.15] tnum">
                {stat.value}
              </div>
            </Blueprint>
          ))}
        </div>
      </div>

      {/* ── 2. Info row ─────────────────────────────────────────────────── */}
      <div className="mx-auto grid max-w-[1280px] gap-4 px-6 pt-6 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        <section className="card p-[14px]">
          <h2 className="eyebrow">About the dealership</h2>
          <p className="text-[14px] leading-[1.6] ink-secondary">
            {dealer.about ?? 'This dealership has not written an introduction yet.'}
          </p>
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

        <section className="card p-[14px]">
          <h2 className="eyebrow">Contact</h2>
          <dl>
            {dealer.contact.map((row) => (
              <div
                key={row.key}
                className="flex justify-between gap-4 border-b border-(--color-divider) py-[9px] text-[13px] last:border-b-0"
              >
                <dt className="ink-muted">{row.label}</dt>
                <dd className={row.mono ? 'font-mono' : row.masked ? 'ink-subtle' : 'font-medium'}>
                  {/* The number is never in this document. `masked` rows carry
                      the invitation, not the value (Rule 7, §14.1). */}
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card p-[14px]">
          <h2 className="eyebrow">Location</h2>
          <Blueprint className="min-h-[120px] flex-1 bg-(--color-surface)">
            <ImageSlot label="Map — dealership location" />
          </Blueprint>
          {dealer.address.directionsUrl ? (
            <a
              href={dealer.address.directionsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-secondary btn-block mt-[10px]"
            >
              Get directions
            </a>
          ) : null}
        </section>
      </div>

      {/* ── 3. Inventory ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1280px] px-6 pb-[60px] pt-[26px]">
        <div className="grid gap-[22px] lg:[grid-template-columns:234px_1fr]">
          <aside className="sticky top-[84px] hidden self-start lg:block">
            <div className="mb-[10px] flex items-baseline">
              <h3 className="eyebrow">Filter inventory</h3>
              <Link href={basePath} className="btn btn-ghost ml-auto text-[12px]">
                Clear
              </Link>
            </div>
            {/* Zero-count rows dim to 0.4 here rather than disappearing (§3.6). */}
            <FilterPanel
              facets={facets}
              params={query}
              basePath={basePath}
              groups={PORTFOLIO_FILTER_GROUPS}
              dimZeroRows
            />
          </aside>

          <div className="min-w-0">
            <div className="mb-[18px] flex flex-wrap items-baseline gap-3">
              <h2 className="text-[28px]">Inventory</h2>
              <span className="text-[14px] ink-muted tnum">{inventory.resultLabel}</span>
              <SearchToolbar params={query} basePath={basePath} showSearch={false} />
              <MobileFilterSheet
                facets={facets}
                params={query}
                basePath={basePath}
                resultCount={inventory.page.total}
                groups={PORTFOLIO_FILTER_GROUPS}
                dimZeroRows
              />
            </div>

            {inventory.data.length > 0 ? (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
                {inventory.data.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} variant="compact" />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nothing matches these filters"
                message={`${dealer.brandName} has cars listed, but none of them match what you have selected.`}
                action={
                  <Link href={basePath} className="btn btn-primary">
                    Clear filters
                  </Link>
                }
              />
            )}

            <Pagination page={inventory.page} params={query} basePath={basePath} />

            <EnquiryForm
              id={ENQUIRY_FORM_ID}
              source="DEALER_PAGE"
              dealerSlug={dealer.slug}
              dealerBrandName={dealer.brandName}
              heading={`Enquire with ${dealer.brandName}`}
              intro={`Looking for something not listed here? Tell ${dealer.brandName} what you want and they will come back to you directly.`}
              messagePlaceholder="Do you have any automatic hatchbacks under ₹7 Lakh?"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Pagination({
  page,
  params,
  basePath,
}: {
  page: DealerVehiclesResponse['page'];
  params: Record<string, string>;
  basePath: string;
}) {
  if (page.totalPages <= 1) return null;

  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Pagination">
      {page.page > 1 ? (
        <Link
          href={buildSearchUrl(basePath, { ...params, page: String(page.page - 1) })}
          rel="prev"
          className="btn btn-secondary"
        >
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-[13px] ink-subtle tnum">
        Page {page.page} of {page.totalPages}
      </span>
      {page.page < page.totalPages ? (
        <Link
          href={buildSearchUrl(basePath, { ...params, page: String(page.page + 1) })}
          rel="next"
          className="btn btn-secondary"
        >
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** `AutoDealer` + `BreadcrumbList` (ARCHITECTURE §17.3), phone deliberately absent. */
function DealerJsonLd({ dealer }: { dealer: DealerPublicProfile }) {
  const { webBaseUrl } = serverConfig();
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AutoDealer',
        name: dealer.brandName,
        legalName: dealer.legalName,
        url: dealer.seo.canonical,
        ...(dealer.about ? { description: dealer.about } : {}),
        address: {
          '@type': 'PostalAddress',
          ...(dealer.address.line ? { streetAddress: dealer.address.line } : {}),
          addressLocality: dealer.address.city,
          addressRegion: dealer.address.state,
          ...(dealer.address.pincode ? { postalCode: dealer.address.pincode } : {}),
          addressCountry: 'IN',
        },
        ...(dealer.address.lat !== null && dealer.address.lng !== null
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: dealer.address.lat,
                longitude: dealer.address.lng,
              },
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: webBaseUrl },
          { '@type': 'ListItem', position: 2, name: 'Dealers', item: `${webBaseUrl}/dealers` },
          { '@type': 'ListItem', position: 3, name: dealer.brandName, item: dealer.seo.canonical },
        ],
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
