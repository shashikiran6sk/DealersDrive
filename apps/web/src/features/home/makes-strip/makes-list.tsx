import Link from 'next/link';

import { cn } from '@/lib/cn';

import type { MakesListProps } from './makes-strip.types';

export function MakesList({ makes, copy = false }: MakesListProps) {
  return (
    <ul
      aria-hidden={copy ? true : undefined}
      inert={copy}
      data-loop-copy={copy ? '' : undefined}
      className={cn('gap-10 px-5 py-5 md:gap-14 md:px-7', copy ? 'hidden' : 'flex')}
    >
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
  );
}
