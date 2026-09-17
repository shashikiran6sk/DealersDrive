import type { Metadata } from 'next';
import Link from 'next/link';

import { Blueprint, Plate } from '@/components/ui/primitives';
import { seoMetadata } from '@/lib/seo';

export const metadata: Metadata = {
  title: {
    absolute: 'Dealers-Drive — used cars from verified independent dealers',
  },
  description:
    'Discover verified independent used-car dealers with transparent listings and direct enquiries on Dealers-Drive.',
  ...seoMetadata({ kind: 'resolved', canonical: '/', isIndexable: true }),
};

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
    title: 'No buyer account needed',
    body: 'Browse, compare and enquire without creating an account. Saved cars will stay on your device.',
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
    body: 'Vehicle search and comparison are coming soon, with the details buyers need to make a shortlist.',
  },
  {
    number: '03',
    title: 'Speak directly to the dealer',
    body: 'Ask questions, arrange a visit and continue the purchase directly with the dealership.',
  },
] as const;

export default function HomePage() {
  return (
    <div>
      <section className="border-b border-(--color-divider) bg-white">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-6 py-12 md:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:py-20">
          <div>
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--color-accent-700)">
              Independent dealers · one trusted platform
            </div>
            <h1 className="max-w-[13ch] text-[42px] leading-[1.02] sm:text-[52px] lg:text-[62px]">
              A clearer way to find your next car
            </h1>
            <p className="mt-5 max-w-[56ch] text-[16px] leading-[1.7] ink-secondary sm:text-[17px]">
              Dealers-Drive brings verified independent dealerships into one place. We provide the
              trusted marketplace; the dealer owns, prices and maintains the car.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/dealers" className="btn btn-primary px-5 py-[10px]">
                Explore verified dealers
              </Link>
              <Link href="/cars" className="btn btn-secondary px-5 py-[10px]">
                Vehicle marketplace — coming soon
              </Link>
            </div>

            <p className="mt-4 text-[12px] ink-subtle">
              The dealer directory is live. Car browsing and saving are the next features arriving.
            </p>
          </div>

          <Blueprint className="bg-(--color-accent-100) p-6 sm:p-8" as="div">
            <div className="flex min-h-[360px] flex-col justify-between">
              <div>
                <Plate size="chip">HOW IT WORKS</Plate>
                <h2 className="mt-5 max-w-[13ch] text-[30px] leading-[1.08] sm:text-[36px]">
                  Trust first, from discovery to dealership
                </h2>
              </div>

              <div className="mt-10 grid gap-0 border-y border-(--color-divider)">
                {[
                  ['Verified', 'Dealer identity and business documents checked'],
                  ['Transparent', 'Dealer-owned inventory with dealer-set prices'],
                  ['Direct', 'Buyer enquiries delivered to the dealership'],
                ].map(([label, detail]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[100px_1fr] gap-4 border-b border-(--color-divider) py-4 last:border-b-0 sm:grid-cols-[120px_1fr]"
                  >
                    <strong className="font-heading text-[14px] text-(--color-accent-800)">
                      {label}
                    </strong>
                    <span className="text-[13px] leading-[1.5] ink-secondary">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </Blueprint>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 py-12 md:py-16">
        <div className="mb-8 max-w-[62ch]">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--color-accent-700)">
            Your journey
          </div>
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
              <div className="font-mono text-[11px] text-(--color-accent-700)">{step.number}</div>
              <h3 className="mt-8 text-[20px]">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.65] ink-secondary">{step.body}</p>
            </Blueprint>
          ))}
        </div>
      </section>

      <section className="border-y border-(--color-divider) bg-white">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-12 md:grid-cols-[0.75fr_1.25fr] md:py-16 lg:gap-20">
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--color-accent-700)">
              Built for both sides
            </div>
            <h2 className="text-[30px] sm:text-[36px]">
              A marketplace where the dealer stays the dealer
            </h2>
            <p className="mt-4 text-[14px] leading-[1.7] ink-secondary">
              Dealers-Drive helps buyers discover trustworthy local businesses and gives independent
              dealerships a professional place to present who they are.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-(--color-divider) bg-(--color-bg) p-6">
              <div className="text-[11px] uppercase tracking-[0.12em] ink-subtle">For buyers</div>
              <h3 className="mt-4 text-[22px]">Know who you are buying from</h3>
              <p className="mt-3 text-[13px] leading-[1.65] ink-secondary">
                Start with verified dealer profiles today. Searchable inventory, saved cars and
                direct vehicle enquiries are coming soon.
              </p>
              <Link href="/dealers" className="btn btn-ghost mt-6">
                Browse the dealer directory →
              </Link>
            </div>

            <div className="border border-(--color-divider) bg-(--color-bg) p-6">
              <div className="text-[11px] uppercase tracking-[0.12em] ink-subtle">For dealers</div>
              <h3 className="mt-4 text-[22px]">Build a trusted digital presence</h3>
              <p className="mt-3 text-[13px] leading-[1.65] ink-secondary">
                Join the verified network, manage your dealership profile and get ready to showcase
                inventory to serious local buyers.
              </p>
              <Link href="/dealer" className="btn btn-ghost mt-6">
                Open the dealer console →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-(--color-accent-900) text-white">
        <div className="mx-auto max-w-[1280px] px-6 py-12 md:py-16">
          <div className="mb-8 max-w-[58ch]">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-(--color-accent-300)">
              Why Dealers-Drive
            </div>
            <h2 className="text-[30px] text-white sm:text-[36px]">
              Confidence without getting in the way
            </h2>
          </div>

          <div className="grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
            {TRUST_POINTS.map((point) => (
              <div key={point.number} className="border-t border-white/25 pt-4">
                <div className="font-mono text-[11px] text-white/55">{point.number}</div>
                <h3 className="mt-5 text-[17px] text-white">{point.title}</h3>
                <p className="mt-2 text-[12px] leading-[1.65] text-white/70">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
