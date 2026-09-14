'use client';

import type { DistrictChip, PublicLocations } from '@dealers-drive/contracts';
import { useState, type ReactNode } from 'react';

import { LocationDialog } from './location-dialog';
import { useDistrictSelection } from './use-district-selection';

export interface DistrictPickerProps {
  locations: PublicLocations;
  /**
   * The control that opens the dialog, given whichever district is currently in
   * the URL so the trigger can name it. A render prop rather than a plain node
   * because the two triggers say different things about the same state: the
   * header names the chosen district, and the directory's button exists
   * precisely when there is none.
   */
  children: (chosen: DistrictChip | null) => ReactNode;
}

/**
 * DESIGN-SPEC §2.14 / §2.18 — the district dialog, and everything that selects a
 * district.
 *
 * **Its own file since R23**, which gave the directory a second opener. What is
 * shared is not only the markup but the *selection rule* — drop `city` and
 * `page`, go to the directory from anywhere else — and a second copy of that
 * rule is how the header and the directory come to disagree about what choosing
 * a district means. So this owns the open state, the selection and the dialog,
 * and takes its trigger as a render prop.
 *
 * **Districts, not cities.** The baseline listed cities off a table **D6**
 * removed; a district is the area somebody would drive across, and the towns
 * inside it give no hint they are related — Arakkonam and Walajapet share a
 * district with Arcot and with nothing else.
 *
 * **A dialog, not a menu (R22).** R19's 220px panel had no height cap and listed
 * 38 districts as one flat column — and the flat column is the real problem, not
 * the height: `Vellore`, `Bangalore`, `Madurai` in one list asks a buyer to know
 * which state each is in, and the ones who would ask are exactly the ones who do
 * not know. So a **state** is a heading you cannot click and the **districts**
 * under it are the buttons.
 *
 * The keyboard is Radix's: Enter or Space opens, focus is trapped, Escape or a
 * backdrop click hands it back to the trigger.
 */
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
      /*
        The button is handed to the dialog rather than wired up outside it:
        Radix's modal content restores focus to *its* trigger on close, so a
        button it does not know about leaves focus on `<body>`. It also makes
        `aria-haspopup="dialog"` and `aria-expanded` Radix's to keep true.
      */
      trigger={children(chosen)}
    />
  );
}
