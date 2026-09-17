import Link from 'next/link';

import { Blueprint, Plate } from '@/components/ui/primitives';

interface ComingSoonProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function ComingSoon({ eyebrow, title, description }: ComingSoonProps) {
  return (
    <div className="mx-auto flex min-h-[560px] max-w-[1280px] items-center px-6 py-12 md:py-16">
      <Blueprint
        className="grid w-full overflow-hidden bg-white md:grid-cols-[1.2fr_0.8fr]"
        as="section"
      >
        <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--color-accent-700)">
            {eyebrow}
          </div>
          <h1 className="mt-4 max-w-[15ch] text-[38px] leading-[1.04] sm:text-[48px]">{title}</h1>
          <p className="mt-5 max-w-[58ch] text-[15px] leading-[1.7] ink-secondary">{description}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/dealers" className="btn btn-primary px-5 py-[10px]">
              Explore verified dealers
            </Link>
            <Link href="/" className="btn btn-secondary px-5 py-[10px]">
              Back to home
            </Link>
          </div>
        </div>

        <div className="flex min-h-[260px] items-center justify-center border-t border-(--color-divider) bg-(--color-accent-100) p-8 md:min-h-[430px] md:border-l md:border-t-0">
          <div className="text-center">
            <Plate size="logo">DD</Plate>
            <div className="mt-5 font-heading text-[26px] font-semibold text-(--color-accent-900)">
              Coming soon
            </div>
            <p className="mx-auto mt-2 max-w-[28ch] text-[13px] leading-[1.6] ink-secondary">
              We are building this experience with the same focus on trust and transparency.
            </p>
          </div>
        </div>
      </Blueprint>
    </div>
  );
}
