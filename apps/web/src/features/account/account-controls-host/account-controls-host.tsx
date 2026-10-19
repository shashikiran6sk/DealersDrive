'use client';

import { useState } from 'react';
import { AccountControls } from '../account-controls';

export function AccountControlsHost({
  customerId,
  canDeactivate,
}: {
  customerId: string | null;
  canDeactivate: boolean;
}) {
  const [previous, setPrevious] = useState({ customerId, canDeactivate });
  if (
    customerId !== null &&
    (customerId !== previous.customerId || canDeactivate !== previous.canDeactivate)
  )
    setPrevious({ customerId, canDeactivate });
  const current = customerId === null ? previous : { customerId, canDeactivate };
  return (
    <AccountControls
      key={`${current.customerId ?? 'guest'}:${current.canDeactivate}`}
      customerId={customerId}
      canDeactivate={canDeactivate}
    />
  );
}
