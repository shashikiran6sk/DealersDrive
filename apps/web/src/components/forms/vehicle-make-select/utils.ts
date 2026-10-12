import { VEHICLE_MAKES, canonicalVehicleMake } from '@dealers-drive/contracts';

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function matchMakes(search: string, saved: string | null = null): string[] {
  const query = compact(search);
  const options = saved ? [saved, ...VEHICLE_MAKES] : [...VEHICLE_MAKES];
  if (!query) return options;
  const alias = canonicalVehicleMake(search);
  return options.filter((make) => compact(make).includes(query) || make === alias);
}
