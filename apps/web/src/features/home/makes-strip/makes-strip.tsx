import Link from 'next/link';

import { MAKES_STRIP_MIN, MAKES_STRIP_TEXT } from './makes-strip.constants';
import type { MakesStripProps } from './makes-strip.types';

export function MakesStrip({ makes }: MakesStripProps) {
  if (makes.length < MAKES_STRIP_MIN) return null;

  return (
    <nav
      aria-label={MAKES_STRIP_TEXT.label}
      data-home-section="makes"
      className="dd-makes border-b border-(--color-divider)"
    >
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="dd-makes-row flex w-max gap-10 px-4 py-5 sm:px-6 md:gap-14 lg:px-10">
          {makes.map((make) => (
            <li key={make.href} className="even:[&>a]:text-(--color-neutral-600)">
              <Link
                href={make.href}
                className="text-[22px] font-extrabold tracking-[-0.03em] whitespace-nowrap hover:underline hover:underline-offset-4 md:text-[clamp(22px,2.6vw,36px)]"
              >
                {make.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
