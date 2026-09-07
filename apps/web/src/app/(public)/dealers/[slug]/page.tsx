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

/** RSC + ISR 10 min — SEO (ARCHITECTURE §15.1). */
export const revalidate = 600;

/**
 * `/dealers/[slug]` — one dealership's public page.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline page has three sections. **Two of them land here in full**,
 * because `GET /v1/dealers/:slug` (**F085**) already answers with everything
 * they render: the header block, and the about / contact / location row.
 *
 * The third is the inventory, and it cannot land yet. It needs
 * `GET /v1/dealers/:slug/vehicles` and `/facets` — both **F076**, over the
 * `listing_search` read model **F064** creates — plus `VehicleCard` (**F075**),
 * `FilterPanel` (**F078**), `SearchToolbar` (**F080**) and `MobileFilterSheet`
 * (**F079**). Nothing on the platform can create a listing until Tier 9 and
 * Tier 10 land, so there is no inventory to filter and no facet to count.
 *
 * What stands in its place is **not a stub**: it is the empty state this page
 * would show anyway for a dealership that has listed nothing, and today that is
 * every dealership. `dealer.stats` already carries `Cars available: 0` from the
 * same endpoint, so the page does not contradict itself. When F076 lands, the
 * grid, the filter rail and the toolbar replace the `EmptyState` below and
 * nothing else on this page changes.
 *
 * Two more absences, both deliberate and both conditional in the baseline too:
 *
 *   · **`RevealContactButton`** (**F090**) rides on a vehicle — A7 is
 *     vehicle-scoped and is the only endpoint that yields a phone number. The
 *     baseline renders it only when `inventory.data[0]` exists, so an empty
 *     yard has never shown it.
 *   · **`EnquiryForm`** (**F089**), and with it the "Enquire with dealer"
 *     button that anchors to it. A button jumping to an anchor that is not on
 *     the page is worse than no button, so both arrive together.
 * ────────────────────────────────────────────────────────────────────────────
 */
async function loadDealer(slug: string): Promise<DealerPublicProfile | null> {
  try {
    return await apiGet<DealerPublicProfile>(`/v1/dealers/${encodeURIComponent(slug)}`, {
      revalidate: 600,
      /*
       * Both tags. `dealer:<slug>` is what this dealership's own save clears;
       * `dealers` is what a moderation decision clears, because approving or
       * suspending changes whether this page may exist at all — and a suspended
       * dealership's portfolio staying up for ten minutes is the one stale
       * window here that is not merely untidy.
       */
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
      dealer.about ??
      `${dealer.brandName} is a verified independent used-car dealership${
        dealer.address.city ? ` in ${dealer.address.city}` : ''
      }.`,
    // A9 resolves indexability (ACTIVE and ≥1 live listing); the policy
    // function turns that into robots + canonical (§17.2). Every dealership is
    // therefore `noindex, follow` until F064 — which is right: a portfolio with
    // nothing in it is a page a search engine should not send anybody to.
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

      {/* ── 1. Header block ─────────────────────────────────────────────── */}
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
            {dealer.address.full ? (
              <p className="mt-[6px] text-[14px] ink-secondary">{dealer.address.full}</p>
            ) : null}
            {/*
              The registered name, under the trading one. They are the same
              string today — `brandName` is the server-written mirror of
              `legalName` — but the pair is what a buyer checks a GSTIN against,
              so the row stays rather than being collapsed on the strength of a
              coincidence that a later feature could undo.
            */}
            <p className="mt-[3px] text-[13px] ink-subtle">{dealer.legalName}</p>
          </div>
        </div>

        <div className="mx-auto grid max-w-[1280px] gap-3 px-6 pb-[20px] [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          {dealer.stats.map((stat) => (
            <Blueprint key={stat.key} className="bg-(--color-surface) p-[14px]">
              <div className="eyebrow">{stat.label}</div>
              <div className="font-heading text-[28px] font-bold leading-[1.15] tnum">
                {stat.value || '—'}
              </div>
            </Blueprint>
          ))}
        </div>

        {/*
          The yard, last in the header and running to the very bottom of it
          (R13). It was a 170px strip above the name, which is where a *logo*
          belongs — a banner, glanced past on the way to the text.

          Below the facts it reads the other way round. A buyer arrives with a
          question the stats answer in a line each — how many cars, how long
          they have been trading, which town — and then wants to see the place.
          So the photograph is what the header ends on, at a size worth looking
          at, with nothing under it but the divider the info row starts from.

          `border-b-0` because that divider belongs to the wrapper; the two
          would otherwise draw the same line twice.
        */}
        <Blueprint className="mx-auto h-[360px] max-w-[1280px] border-b-0 bg-(--color-surface) max-lg:h-[280px] max-md:h-[200px]">
          {dealer.coverUrl ? (
            /* The 1600px rendition — this is the one place a yard photograph is
               looked at rather than glanced past. See `dealer-card.tsx` for why
               it is a plain `<img>` and why the alt is empty. */
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dealer.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            /* A dealership that has not uploaded one yet. */
            <ImageSlot label="Dealership frontage / yard photo" />
          )}
        </Blueprint>
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
                      the invitation, not the value (Rule 7, §14.1) — and the
                      button that acts on it is A7, which is vehicle-scoped and
                      arrives with F090. */}
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <LocationCard address={dealer.address} brandName={dealer.brandName} />
      </div>

      {/* ── 3. Inventory ────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1280px] px-6 pb-[60px] pt-[26px]">
        <div className="mb-[18px] flex flex-wrap items-baseline gap-3">
          <h2 className="text-[28px]">Inventory</h2>
          <span className="text-[14px] ink-muted tnum">{carCountLabel(dealer)}</span>
        </div>

        {/*
          The filter rail, the toolbar and the card grid belong here — F078,
          F080/F079 and F075, over F076's two endpoints. See the note at the top
          of this file: what is below is the empty state this page would show
          anyway for a dealership that has listed nothing, which today is every
          dealership on the platform.
        */}
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

/**
 * The count, from the stat the API already composed rather than from a second
 * derivation of the same fact.
 */
function carCountLabel(dealer: DealerPublicProfile): string {
  const cars = dealer.stats.find((stat) => stat.key === 'cars')?.value ?? '0';
  return `${cars} ${cars === '1' ? 'car' : 'cars'} available`;
}

/**
 * `AutoDealer` + `BreadcrumbList` (ARCHITECTURE §17.3), phone deliberately
 * absent — structured data is the easiest place in a page to leak a field
 * nobody meant to publish, and rule 7 applies to it exactly as it does to the
 * rendered document.
 *
 * The baseline emitted a `geo` block from `dealer.address.lat/lng`, and those
 * were the *town's* coordinates off a `cities` row **D6** removed — a claim
 * about a place that is not the dealership.
 *
 * `address.geo` is the yard now, read out of the dealer's own share link, and
 * it is still not published here. A `GeoCoordinates` block is read by machines
 * that will not check it, and these coordinates come from a link a dealer
 * pasted rather than from anything surveyed: good enough to centre a map a
 * person is looking at, not good enough to assert to a search engine. The map
 * is in `LocationCard`; `mapsUrl` (R6) is in the anchor beside it.
 */
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
