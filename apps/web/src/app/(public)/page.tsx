import type { Metadata } from 'next';
import type { CSSProperties } from 'react';

import { SectionError } from '@/components/errors/section-error';
import { CarSearchBox } from '@/components/search/car-search-box';
import { JsonLd } from '@/components/seo/json-ld';
import { AudienceSection } from '@/features/home/audience-section';
import { CategoryDeck } from '@/features/home/category-deck';
import { CategoryShortcuts } from '@/features/home/category-shortcuts';
import { DiscoveryBand } from '@/features/home/discovery-row';
import { HeroBanner, heroImageFrom } from '@/features/home/hero-banner';
import {
  HOME_CATEGORIES,
  HOME_SEARCH_PATH,
  HOME_TEXT,
  RECENT_ROW_COUNT,
  RECENT_ROW_ID,
} from '@/features/home/home.constants';
import { JourneySection } from '@/features/home/journey-section';
import { loadHomeInventory } from '@/features/home/load-home';
import { MakesStrip } from '@/features/home/makes-strip';
import { STOCK_STREAM_MIN_CARS, StockStream } from '@/features/home/stock-stream';
import { categoryHref } from '@/features/home/utils';
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

function rise(index: number): CSSProperties & { '--rise-index': number } {
  return { '--rise-index': index };
}

const SHORTCUTS = HOME_CATEGORIES.map((category) => ({
  ...category,
  href: categoryHref(category),
}));

export default async function HomePage() {
  const [inventory, config] = await Promise.all([loadHomeInventory(), getPublicConfig()]);
  const streaming = inventory.recent.length >= STOCK_STREAM_MIN_CARS;

  return (
    <div>
      <JsonLd nodes={[organizationSchema(config), websiteSchema()]} />
      <HeroBanner
        image={heroImageFrom(config.heroImage)}
        aside={streaming ? <StockStream cars={inventory.recent} /> : null}
      >
        <div className="dd-rise eyebrow mb-4" style={rise(0)}>
          {HOME_TEXT.eyebrow}
        </div>
        <h1 className="max-w-[14ch] text-[42px] leading-none tracking-[-0.05em] sm:text-[56px] lg:text-[clamp(56px,5.4vw,80px)]">
          {HOME_TEXT.title}
        </h1>
        <p
          className="dd-rise mt-5 max-w-[46ch] text-[16px] leading-[1.75] ink-secondary"
          style={rise(1)}
        >
          {HOME_TEXT.lede}
        </p>
        <div className="dd-rise relative z-10 mt-7" style={rise(2)}>
          <CarSearchBox
            params={{}}
            basePath={HOME_SEARCH_PATH}
            action={HOME_SEARCH_PATH}
            className="sm:max-w-[560px]"
          />
        </div>
        <CategoryShortcuts categories={SHORTCUTS} className="mt-5" />
      </HeroBanner>

      {inventory.unavailable ? (
        <div
          aria-label={HOME_TEXT.discoveryLabel}
          role="region"
          className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10 lg:py-12"
        >
          <SectionError title={HOME_TEXT.unavailableTitle} message={HOME_TEXT.unavailableMessage} />
        </div>
      ) : null}

      <MakesStrip makes={inventory.makes} />
      <CategoryDeck categories={inventory.categories} />
      <DiscoveryBand
        row={{
          id: RECENT_ROW_ID,
          title: HOME_TEXT.recentTitle,
          href: HOME_SEARCH_PATH,
          cars: inventory.recent.slice(0, RECENT_ROW_COUNT),
        }}
      />
      <JourneySection />
      <AudienceSection />
    </div>
  );
}
