import type { Metadata } from 'next';
import Link from 'next/link';

import { CarSearchBox } from '@/components/search/car-search-box';
import { Blueprint } from '@/components/ui/primitives';
import { DiscoveryRow } from '@/features/home/discovery-row';
import { HeroBanner, heroImageFrom } from '@/features/home/hero-banner';
import { HOME_SEARCH_PATH, HOME_TEXT } from '@/features/home/home.constants';
import { loadHomeInventory } from '@/features/home/load-home';
import { JsonLd } from '@/components/seo/json-ld';
import { getPublicConfig } from '@/lib/public-config';
import {
  HOME_TITLE,
  organizationSchema,
  pageMetadata,
  SITE_DESCRIPTION,
  websiteSchema,
} from '@/lib/seo';

export const revalidate = 60;

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: { absolute: HOME_TITLE },
    description: SITE_DESCRIPTION,
    route: { kind: 'resolved', canonical: '/', isIndexable: true },
  });
}

const TRUST_POINTS = [
  {
    number: '01',
    title: 'Verified independent dealers',
    body: 'We check dealer identity and business documents before a dealership joins the platform.',
  },
  {
    number: '02',
    title: 'Reviewed vehicle listings',
    body: 'Listings are reviewed for clear photos, useful details and straightforward pricing before publication.',
  },
  {
    number: '03',
    title: 'Direct conversations',
    body: 'Your enquiry goes to the dealership that owns the vehicle, without a call centre in between.',
  },
  {
    number: '04',
    title: 'Dealer-set prices',
    body: 'The price you see is set by the dealer. Dealers-Drive does not add a marketplace markup.',
  },
  {
    number: '05',
    title: 'Your number, proved once',
    body: 'Browse without an account. When you enquire, you sign in with your mobile number, so the dealer knows the lead is real.',
  },
] as const;

const JOURNEY = [
  {
    number: '01',
    title: 'Find a trusted dealership',
    body: 'Explore our live directory of independent dealers whose identity and business have been checked.',
  },
  {
    number: '02',
    title: 'Discover the right car',
    body: 'Search cars Dealers-Drive has photographed and reviewed by make, model or variant.',
  },
  {
    number: '03',
    title: 'Speak directly to the dealer',
    body: 'Ask questions, arrange a visit and continue the purchase directly with the dealership.',
  },
] as const;

export default async function HomePage() {
  const [inventory, config] = await Promise.all([loadHomeInventory(), getPublicConfig()]);

  return (
    <div>
      <JsonLd nodes={[organizationSchema(config), websiteSchema()]} />
      <HeroBanner image={heroImageFrom(config.heroImage)}>
        <div className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/80">
          {HOME_TEXT.eyebrow}
        </div>
        <h1 className="max-w-[14ch] text-[40px] leading-[1.05] tracking-[-0.04em] text-white sm:text-[48px] lg:text-[56px]">
          {HOME_TEXT.title}
        </h1>
        <p className="mt-5 max-w-[52ch] text-[15px] leading-[1.8] text-white/85">
          {HOME_TEXT.lede}
        </p>

        <div className="mt-7 text-(--color-ink)">
          <CarSearchBox
            params={{}}
            basePath={HOME_SEARCH_PATH}
            action={HOME_SEARCH_PATH}
            className="sm:max-w-[560px]"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/cars" className="dd-chip">
            {HOME_TEXT.browseAll}
          </Link>
          <Link href="/dealers" className="dd-chip">
            {HOME_TEXT.browseDealers}
          </Link>
        </div>
      </HeroBanner>

      {inventory.rows.some((row) => row.cars.length > 0) ? (
        <div
          aria-label={HOME_TEXT.discoveryLabel}
          role="region"
          className="mx-auto flex max-w-[1440px] flex-col gap-[48px] px-4 py-10 sm:px-6 lg:px-10 lg:py-12"
        >
          {inventory.rows.map((row) => (
            <DiscoveryRow key={row.id} {...row} />
          ))}
        </div>
      ) : null}

      <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 md:py-16 lg:px-10">
        <div className="mb-8 max-w-[62ch]">
          <div className="eyebrow mb-3">Your journey</div>
          <h2 className="text-[30px] sm:text-[36px]">
            From local discovery to a real conversation
          </h2>
          <p className="mt-3 text-[15px] ink-secondary">
            Dealers-Drive is designed to help buyers make an informed shortlist while keeping the
            dealership at the centre of every sale.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {JOURNEY.map((step) => (
            <Blueprint key={step.number} className="bg-white p-6" as="article">
              <div className="font-mono text-[11px] ink-muted">{step.number}</div>
              <h3 className="mt-8 text-[20px]">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.65] ink-secondary">{step.body}</p>
            </Blueprint>
          ))}
        </div>
      </section>

      <section className="border-y border-(--color-divider) bg-white">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[0.75fr_1.25fr] md:py-16 lg:gap-20 lg:px-10">
          <div>
            <div className="eyebrow mb-3">Built for both sides</div>
            <h2 className="text-[30px] sm:text-[36px]">
              A marketplace where the dealer stays the dealer
            </h2>
            <p className="mt-4 text-[14px] leading-[1.7] ink-secondary">
              Dealers-Drive helps buyers discover trustworthy local businesses and gives independent
              dealerships a professional place to present who they are.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[16px] border border-(--color-divider) bg-(--color-bg) p-6">
              <div className="eyebrow">For buyers</div>
              <h3 className="mt-4 text-[22px]">Know who you are buying from</h3>
              <p className="mt-3 text-[13px] leading-[1.65] ink-secondary">
                Start with verified dealer profiles and cars reviewed before they go live, then
                enquire about a car directly with the dealership that owns it.
              </p>
              <Link
                href="/dealers"
                className="btn btn-ghost mt-6 -ml-2 whitespace-normal text-left"
              >
                Browse the dealer directory →
              </Link>
            </div>

            <div className="rounded-[16px] border border-(--color-divider) bg-(--color-bg) p-6">
              <div className="eyebrow">For dealers</div>
              <h3 className="mt-4 text-[22px]">Build a trusted digital presence</h3>
              <p className="mt-3 text-[13px] leading-[1.65] ink-secondary">
                Join the verified network, manage your dealership profile and get ready to showcase
                inventory to serious local buyers.
              </p>
              <Link href="/dealer" className="btn btn-ghost mt-6 -ml-2 whitespace-normal text-left">
                Open the dealer console →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-(--color-accent-900) text-white">
        <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 md:py-16 lg:px-10">
          <div className="mb-8 max-w-[58ch]">
            <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.12em] text-(--color-accent-400)">
              Why Dealers-Drive
            </div>
            <h2 className="text-[30px] text-white sm:text-[36px]">
              Confidence without getting in the way
            </h2>
          </div>

          <div className="grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
            {TRUST_POINTS.map((point) => (
              <div key={point.number} className="border-t border-white/25 pt-4">
                <div className="font-mono text-[11px] text-white/60">{point.number}</div>
                <h3 className="mt-5 text-[17px] text-white">{point.title}</h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-white/75">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
