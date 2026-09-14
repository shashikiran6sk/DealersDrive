import type { DistrictChip } from '@dealers-drive/contracts';

export interface StateGroup {
  /** Stable across renders and safe in an `id`; the state name is neither. */
  key: string;
  state: string | null;
  districts: DistrictChip[];
}
