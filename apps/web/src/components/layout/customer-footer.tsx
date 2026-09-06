import Link from 'next/link';

import { Plate } from '@/components/ui/primitives';

/**
 * Quiet by design: a hairline, a wordmark, and the sentence the whole product
 * rests on — the dealer is the merchant, we are the rails (§16.1).
 *
 * A server component. It reads nothing and handles nothing, so it ships no
 * JavaScript at all (invariant 8).
 */
export function CustomerFooter() {
  return (
    <footer className="border-t border-(--color-divider) bg-white">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-4 px-6 py-8">
        <div className="flex items-center gap-[9px]">
          <Plate size="logo">DD</Plate>
          <span className="font-heading text-[15px] font-bold">Dealers-Drive</span>
        </div>
        <p className="max-w-[52ch] text-[12px] ink-subtle">
          Dealers-Drive verifies dealer identity and business documents. Every vehicle is owned,
          priced and warranted by the dealer who lists it.
        </p>
        <nav className="ml-auto flex flex-wrap gap-5 text-[13px] ink-secondary" aria-label="Footer">
          <Link href="/cars">Buy cars</Link>
          <Link href="/dealers">Dealers</Link>
          <Link href="/saved">Saved cars</Link>
          <Link href="/dealer">For dealers</Link>
        </nav>
      </div>
    </footer>
  );
}
