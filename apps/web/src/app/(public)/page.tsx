import type { Metadata } from 'next';
import Link from 'next/link';
import type { ComponentType } from 'react';

import { SectionError } from '@/components/errors/section-error';
import { CarSearchBox } from '@/components/search/car-search-box';
import { LinkPendingLabel } from '@/components/ui/link-pending';
import { AudienceSection } from '@/features/home/audience-section';
import { DiscoveryBand } from '@/features/home/discovery-row';
import { HeroBanner, heroImageFrom } from '@/features/home/hero-banner';
import {
  HOME_FLOW,
  HOME_SEARCH_PATH,
  HOME_TEXT,
  discoveryRowId,
  type HomeInfoSection,
} from '@/features/home/home.constants';
import { JourneySection } from '@/features/home/journey-section';
import { loadHomeInventory } from '@/features/home/load-home';
import { TrustSection } from '@/features/home/trust-section';
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

const INFO_SECTIONS: Record<HomeInfoSection, ComponentType> = {
  journey: JourneySection,
  trust: TrustSection,
  audience: AudienceSection,
};

export default async function HomePage() {
  const [inventory, config] = await Promise.all([loadHomeInventory(), getPublicConfig()]);
  const rows = new Map(inventory.rows.map((row) => [row.id, row]));

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
          <Link href="/cars" className="relative dd-chip">
            <LinkPendingLabel>{HOME_TEXT.browseAll}</LinkPendingLabel>
          </Link>
          <Link href="/dealers" className="relative dd-chip">
            <LinkPendingLabel>{HOME_TEXT.browseDealers}</LinkPendingLabel>
          </Link>
        </div>
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

      {HOME_FLOW.map((item) => {
        if (item.kind === 'info') {
          const Section = INFO_SECTIONS[item.key];
          return <Section key={item.key} />;
        }
        return <DiscoveryBand key={item.key} row={rows.get(discoveryRowId(item.key))} />;
      })}
    </div>
  );
}
