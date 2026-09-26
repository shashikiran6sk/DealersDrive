import type { PublicVehicleDetail } from '@dealers-drive/contracts';
import Link from 'next/link';

import { LogoTile, Plate } from '@/components/ui/primitives';

import { VDP_DEALER_TEXT } from './vdp-dealer-card.constants';

export function VdpDealerCard({ dealer }: { dealer: PublicVehicleDetail['dealer'] }) {
  return (
    <section aria-labelledby="vdp-dealer-heading" className="card gap-[10px] bg-white p-4">
      <span className="text-[11px] tracking-[0.12em] uppercase ink-subtle">
        {VDP_DEALER_TEXT.soldBy}
      </span>
      <div className="flex items-center gap-3">
        <LogoTile initials={dealer.initials} size={42} />
        <div className="min-w-0">
          <h2 id="vdp-dealer-heading" className="truncate text-[16px]">
            {dealer.name}
          </h2>
          {dealer.location ? <p className="text-[13px] ink-secondary">{dealer.location}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--color-divider) pt-[10px]">
        {dealer.isVerified ? <Plate size="chip">{VDP_DEALER_TEXT.verified}</Plate> : <span />}
        <Link
          href={`/dealers/${encodeURIComponent(dealer.slug)}`}
          className="btn btn-ghost text-[13px]"
        >
          {VDP_DEALER_TEXT.view}
        </Link>
      </div>
      <p className="text-[12px] ink-subtle">{VDP_DEALER_TEXT.trust}</p>
    </section>
  );
}
