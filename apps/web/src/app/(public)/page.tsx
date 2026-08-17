import type { HomeResponse } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { HeroSearch } from '@/components/search/hero-search';
import { Blueprint, ImageSlot, LogoTile, Tag } from '@/components/ui/primitives';
import { VehicleCard } from '@/components/vehicle/vehicle-card';
import { apiGet, qs } from '@/lib/api';
import { serverConfig } from '@/lib/config';
import { seoMetadata } from '@/lib/seo';
import type { SearchParamsInput } from '@/lib/url';

/** RSC + ISR 5 minutes — SEO-critical and near-static (ARCHITECTURE §15.1). */
export const revalidate = 300;

export const metadata: Metadata = {
  title: {
    absolute: 'Dealers-Drive — used cars from verified independent dealers in Tamil Nadu',
  },
  ...seoMetadata({ kind: 'home' }),
};

const WHY_POINTS = [
  {
    n: '01',
    title: 'Every dealer is verified',
    body: 'Identity, GSTIN, PAN and address proof are checked by our team before a single car goes live.',
  },
  {
    n: '02',
    title: 'Every listing is reviewed',
    body: 'A person looks at the photos, the price and the odometer reading before a listing reaches you.',
  },
  {
    n: '03',
    title: 'You deal with the dealer',
    body: 'Enquiries go straight to the yard. We never sit between you and the person selling the car.',
  },
  {
    n: '04',
    title: 'Real photographs',
    body: 'At least six photos of the actual vehicle — no stock images, no borrowed brochure shots.',
  },
  {
    n: '05',
    title: 'No account needed',
    body: 'Browse, compare, save and enquire without signing up. Your saved cars stay on your device.',
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const params = await searchParams;
  const city = typeof params.city === 'string' ? params.city : undefined;
  const home = await apiGet<HomeResponse>(`/v1/home${qs({ city })}`, { revalidate: 300 });

  return (
    <div>
      <HomeJsonLd />

      {/* 1 — Hero (DESIGN-SPEC §3.2) */}
      <section className="border-b border-(--color-divider) bg-white">
        <div className="mx-auto grid max-w-[1280px] items-center gap-9 px-6 pb-11 pt-14 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))] max-md:pb-7 max-md:pt-9">
          <div>
            <div className="mb-[14px] text-[11px] uppercase tracking-[0.14em] text-(--color-accent-700)">
              Independent dealers · one platform
            </div>
            <h1 className="mb-[14px] max-w-[12ch] text-[38px] leading-[1.02] md:text-[52px]">
              Find your next car
            </h1>
            <p className="max-w-[46ch] text-[16px] ink-secondary">
              Every vehicle on Dealers-Drive is owned, priced and maintained by a verified
              independent dealer near you. We provide the rails — they provide the car.
            </p>

            <HeroSearch cityName={home.city.name} citySlug={city} />

            <div className="mt-[18px] flex flex-wrap items-center gap-2">
              <span className="text-[12px] ink-subtle">Popular:</span>
              {home.popularSearches.map((item) => (
                <Link key={item.href} href={item.href} className="btn btn-secondary text-[12px] px-[10px] py-[4px]">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <Blueprint className="aspect-[4/3] bg-(--color-surface)">
            <ImageSlot label={`Hero — dealer forecourt, ${home.city.name}`} />
          </Blueprint>
        </div>
      </section>

      {/* 2 — Featured inventory */}
      <section className="mx-auto max-w-[1280px] px-6 py-11">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h2 className="text-[28px]">Featured inventory</h2>
          <Link href="/cars" className="btn btn-ghost">
            View all <span className="tnum">{home.activeCount}</span> cars →
          </Link>
        </div>

        {home.featured.length > 0 ? (
          <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(262px,1fr))]">
            {home.featured.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        ) : (
          <Blueprint className="bg-white px-6 py-11 text-center">
            <div className="font-heading text-[20px] font-semibold">No cars listed yet</div>
            <p className="mt-[6px] text-[13px] ink-muted">
              Dealers in {home.city.name} are still adding their inventory.
            </p>
          </Blueprint>
        )}
      </section>

      {/* 3 — Browse by body type. A zero-count tile still renders (A1). */}
      <section className="border-t border-(--color-divider) bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-11">
          <h2 className="mb-5 text-[28px]">Browse by body type</h2>
          <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
            {home.bodyTypes.map((body) => (
              <Blueprint key={body.slug} className="bg-(--color-bg)" as="div">
                <Link
                  href={`/cars${qs({ city, bodyType: body.slug })}`}
                  className="block px-4 py-[18px]"
                  aria-disabled={body.count === 0 || undefined}
                >
                  <div className="font-heading text-[18px] font-semibold">{body.label}</div>
                  <div className="text-[12px] ink-subtle tnum">{body.count} cars</div>
                </Link>
              </Blueprint>
            ))}
          </div>
        </div>
      </section>

      {/* 4 — Trusted dealers */}
      <section className="mx-auto max-w-[1280px] px-6 py-11">
        <h2 className="mb-5 text-[28px]">Trusted dealers in {home.city.name}</h2>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
          {home.dealers.map((dealer) => (
            <Link key={dealer.slug} href={`/dealers/${dealer.slug}`} className="card gap-[10px]">
              <div className="flex items-center gap-[10px]">
                <LogoTile initials={dealer.initials} size={36} />
                <div>
                  <div className="font-heading text-[15px] font-semibold">{dealer.brandName}</div>
                  <div className="text-[11px] ink-subtle">{dealer.city}</div>
                </div>
              </div>
              <div className="flex gap-[14px] border-t border-(--color-divider) pt-[9px] text-[12px]">
                <span>
                  <strong className="tnum">{dealer.carCount}</strong> cars
                </span>
                <span>
                  <strong className="tnum">{dealer.yearsOperating}</strong> yrs
                </span>
                {dealer.isVerified ? (
                  <Tag variant="accent" className="ml-auto text-[10px]">
                    Verified
                  </Tag>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 5 — Why Dealers-Drive, on the cobalt-900 field */}
      <section className="border-t border-(--color-divider) bg-(--color-accent-900) text-white">
        <div className="mx-auto max-w-[1280px] px-6 py-12">
          <h2 className="mb-6 text-[28px] text-white">Why Dealers-Drive</h2>
          <div className="grid gap-[26px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
            {WHY_POINTS.map((point) => (
              <div key={point.n} className="border-t border-white/25 pt-[13px]">
                <div className="mb-[7px] font-mono text-[11px] opacity-60">{point.n}</div>
                <div className="mb-[5px] font-heading text-[17px] font-semibold">{point.title}</div>
                <div className="text-[13px] opacity-75">{point.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/** `Organization` + `WebSite` with a `SearchAction` (ARCHITECTURE §17.3). */
function HomeJsonLd() {
  const { webBaseUrl } = serverConfig();
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Dealers-Drive',
        url: webBaseUrl,
        description: 'A marketplace for used cars from verified independent dealers in Tamil Nadu.',
      },
      {
        '@type': 'WebSite',
        url: webBaseUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${webBaseUrl}/cars?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
