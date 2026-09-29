import type { VehicleCardDto } from '@dealers-drive/contracts';

import { Avatar, Tag } from '@/components/ui/primitives';

import { VEHICLE_CARD_TEXT } from './vehicle-card.constants';

export function DealerStrip({ dealer }: { dealer: VehicleCardDto['dealer'] }) {
  return (
    <div className="mt-auto flex min-h-[35px] items-center gap-[8px] border-t border-(--color-divider) pt-[10px]">
      <Avatar initials={dealer.initials} size={20} />
      <span className="min-w-0 flex-1 truncate text-[13px]">{dealer.name}</span>
      {dealer.isVerified ? (
        <Tag variant="accent" className="text-[10px]">
          {VEHICLE_CARD_TEXT.verified}
        </Tag>
      ) : null}
    </div>
  );
}
