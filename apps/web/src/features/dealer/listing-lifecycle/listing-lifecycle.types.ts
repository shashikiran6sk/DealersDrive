import type {
  DealerListing,
  ListingLifecycleAction,
  WithdrawListingInput,
} from '@dealers-drive/contracts';

export interface LifecycleMove {
  label: string;
  title: string;
  description: string;
  confirm: string;
  tone: 'primary' | 'danger';
}

export type LifecycleResult = { ok: true } | { ok: false; message: string };

export type LifecycleSubmit = (
  vehicleId: string,
  action: ListingLifecycleAction,
  withdrawal?: WithdrawListingInput,
) => Promise<LifecycleResult>;

export interface ListingLifecycleActionsProps {
  vehicleId: string;
  vehicleTitle: string;
  actions: readonly ListingLifecycleAction[];
  size?: 'sm' | 'default';
  submit?: LifecycleSubmit;
}

export interface LifecycleDialogProps {
  vehicleId: string;
  action: ListingLifecycleAction;
  size: 'sm' | 'default';
  submit: LifecycleSubmit;
}

export interface ListingLifecyclePanelProps {
  vehicleId: string;
  vehicleTitle: string;
  listing: DealerListing;
}
