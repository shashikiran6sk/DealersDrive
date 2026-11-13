import { Fragment } from 'react';

import { PAGE_SLOT_KEY } from './page-slot.constants';
import type { PageSlotProps } from './page-slot.types';

export function PageSlot({ children }: PageSlotProps) {
  return <Fragment key={PAGE_SLOT_KEY}>{children}</Fragment>;
}
