import { titleWithoutYear } from '@dealers-drive/contracts';

import type { VehicleNameProps } from './vehicle-name.types';

export function VehicleName({ title, year }: VehicleNameProps) {
  const name = titleWithoutYear({ title, year });
  const hiddenYear = name === title ? null : year;

  return (
    <>
      {hiddenYear === null ? null : (
        <>
          <span className="sr-only">{String(hiddenYear)}</span>{' '}
        </>
      )}
      <span data-slot="vehicle-name">{name}</span>
    </>
  );
}
