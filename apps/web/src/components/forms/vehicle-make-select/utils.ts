import { VEHICLE_MAKES, canonicalVehicleMake } from '@dealers-drive/contracts';

export function matchMakes(search: string, saved: string | null = null): string[] {
  const query = search.trim().toLowerCase();
  const options = saved ? [saved, ...VEHICLE_MAKES] : [...VEHICLE_MAKES];
  if (!query) return options;
  const alias = canonicalVehicleMake(search);
  return options.filter((make) => make.toLowerCase().includes(query) || make === alias);
}
