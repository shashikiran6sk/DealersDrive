'use client';

import type { DistrictChip, PublicLocations } from '@dealers-drive/contracts';
import { useState, type ReactNode } from 'react';

import { LocationDialog } from './location-dialog';
import { useDistrictSelection } from './use-district-selection';

export interface DistrictPickerProps {
  locations: PublicLocations;
  children: (chosen: DistrictChip | null) => ReactNode;
}

export function DistrictPicker({ locations, children }: DistrictPickerProps) {
  const [open, setOpen] = useState(false);
  const { chosen, select } = useDistrictSelection(locations);

  return (
    <LocationDialog
      open={open}
      onOpenChange={setOpen}
      locations={locations}
      chosen={chosen}
      onSelect={(slug) => {
        select(slug);
        setOpen(false);
      }}
      trigger={children(chosen)}
    />
  );
}
