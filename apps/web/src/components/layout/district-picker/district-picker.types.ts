import type { DistrictChip } from '@dealers-drive/contracts';

export interface StateGroup {
  key: string;
  state: string | null;
  districts: DistrictChip[];
}
