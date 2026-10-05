import Link from 'next/link';

import { AUDIENCE_CARDS, AUDIENCE_TEXT } from './audience-section.constants';
import { LinkPendingLabel } from '@/components/ui/link-pending';

export function AudienceSection() {
  return (
    <section
      aria-labelledby="home-audience-heading"
      data-home-section="audience"
      className="border-y border-(--color-divider) bg-white"
    >
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[0.75fr_1.25fr] md:py-16 lg:gap-20 lg:px-10">
        <div>
          <div className="eyebrow mb-3">{AUDIENCE_TEXT.eyebrow}</div>
          <h2 id="home-audience-heading" className="text-[30px] sm:text-[36px]">
            {AUDIENCE_TEXT.title}
          </h2>
          <p className="mt-4 text-[14px] leading-[1.7] ink-secondary">{AUDIENCE_TEXT.body}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {AUDIENCE_CARDS.map((card) => (
            <div
              key={card.key}
              className="rounded-[16px] border border-(--color-divider) bg-(--color-bg) p-6"
            >
              <div className="eyebrow">{card.eyebrow}</div>
              <h3 className="mt-4 text-[22px]">{card.title}</h3>
              <p className="mt-3 text-[13px] leading-[1.65] ink-secondary">{card.body}</p>
              <Link
                href={card.href}
                className="relative btn btn-ghost mt-6 -ml-2 whitespace-normal text-left"
              >
                <LinkPendingLabel>{card.link}</LinkPendingLabel>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
