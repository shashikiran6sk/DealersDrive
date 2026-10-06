import type { SalesVehiclesResponse } from '@dealers-drive/contracts';
import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';
import { StatusTag } from '@/components/ui/primitives';

import { SALES_VEHICLE_TEXT } from './sales-vehicle-list.constants';

export function SalesVehicleList({
  dealerId,
  listings,
}: {
  dealerId: string;
  listings: SalesVehiclesResponse;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!listings.canCreate ? (
        <p className="text-[13px] text-(--color-warn)">{SALES_VEHICLE_TEXT.closed}</p>
      ) : !listings.dealerApproved ? (
        <p className="text-[13px] ink-muted">{SALES_VEHICLE_TEXT.notApproved}</p>
      ) : null}

      {listings.data.length === 0 ? (
        <p className="text-[13px] ink-body">{SALES_VEHICLE_TEXT.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-(--color-divider)">
          {listings.data.map((vehicle) => (
            <li key={vehicle.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={SALES_VEHICLE_TEXT.editHref(dealerId, vehicle.id)}
                  className="text-[14px] font-semibold break-words"
                >
                  {vehicle.title}
                </Link>
                <p className="text-[12px] ink-muted">
                  <span className="font-mono">{vehicle.registrationDisplay}</span>
                  {vehicle.priceLabel ? ` · ${vehicle.priceLabel}` : ''}
                  {` · ${vehicle.updatedLabel}`}
                </p>
                {vehicle.reason ? (
                  <p className="text-[12px] text-(--color-warn)">{vehicle.reason}</p>
                ) : null}
              </div>
              <StatusTag tone={vehicle.statusTone}>{vehicle.statusLabel}</StatusTag>
            </li>
          ))}
        </ul>
      )}

      {listings.canCreate ? (
        <div>
          <ButtonLink href={SALES_VEHICLE_TEXT.newHref(dealerId)} variant="primary">
            {SALES_VEHICLE_TEXT.start}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
