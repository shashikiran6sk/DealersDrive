import type { DealerPublicProfile } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LocationCard } from '@/components/dealers/location-card';
import { Blueprint, EmptyState, ImageSlot, LogoTile, Plate, Tag } from '@/components/ui/primitives';
import { ApiError, apiGet } from '@/lib/api';
import { dealerTag, DEALERS_TAG } from '@/lib/cache-tags';
import { serverConfig } from '@/lib/config';
import { seoMetadata } from '@/lib/seo';

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
      dealer.tagline ??
      `${dealer.brandName} is a verified independent used-car dealership${
        dealer.address.city ? ` in ${dealer.address.city}` : ''
      }.`,
    ...seoMetadata({
      kind: 'resolved',
      canonical: dealer.seo.canonical,
      isIndexable: dealer.seo.isIndexable,
    }),
  };
}

export default async function DealerPortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dealer = await loadDealer(slug);
  if (!dealer) notFound();

  return (
    <div>
      <DealerJsonLd dealer={dealer} />

      <div className="border-b border-(--color-divider) bg-white">
        <div className="mx-auto max-w-[1280px] px-6 pt-[22px]">
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
              <h1 className="text-[34px] leading-[1.08]">{dealer.brandName}</h1>
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

        <div className="mx-auto max-w-[1280px] px-6 pb-[20px]">
          <Blueprint className="h-[440px] bg-(--color-surface) max-lg:h-[340px] max-md:h-[240px]">
            {dealer.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dealer.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageSlot label="Dealership frontage / yard photo" />
            )}
          </Blueprint>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-4 px-6 pt-6 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        <section className="card p-[14px]">
          <h2 className="eyebrow">Dealership details</h2>

          <dl className="border-t border-(--color-divider)">
            {detailRows(dealer).map((row) => (
              <div
                key={row.key}
                className="flex justify-between gap-4 border-b border-(--color-divider) py-[9px] text-[13px] last:border-b-0"
              >
                <dt className="ink-muted">{row.label}</dt>
                <dd className={row.mono ? 'font-mono' : 'font-medium'}>{row.value}</dd>
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

      <div className="mx-auto max-w-[1280px] px-6 pb-[60px] pt-[26px]">
        <div className="mb-[18px] flex flex-wrap items-baseline gap-3">
          <h2 className="text-[28px]">Inventory</h2>
          <span className="text-[14px] ink-muted tnum">{carCountLabel(dealer)}</span>
        </div>

        <EmptyState
          title={`${dealer.brandName} has no cars listed yet`}
          message="This dealership is verified and open for enquiries — it has not put a vehicle on the marketplace yet. Browse every verified dealership in the meantime."
          action={
            <Link href="/dealers" className="btn btn-primary">
              Back to dealers
            </Link>
          }
        />
      </div>
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

function carCountLabel(dealer: DealerPublicProfile): string {
  const cars = dealer.stats.find((stat) => stat.key === 'cars')?.value ?? '0';
  return `${cars} ${cars === '1' ? 'car' : 'cars'} available`;
}

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
        ...(dealer.tagline ? { description: dealer.tagline } : {}),
        address: {
          '@type': 'PostalAddress',
          ...(dealer.address.line ? { streetAddress: dealer.address.line } : {}),
          ...(dealer.address.city ? { addressLocality: dealer.address.city } : {}),
          ...(dealer.address.state ? { addressRegion: dealer.address.state } : {}),
          ...(dealer.address.pincode ? { postalCode: dealer.address.pincode } : {}),
          addressCountry: 'IN',
        },
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
