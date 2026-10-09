import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { RangePresets } from '@/components/search/filter-panel/range-presets';

const bands = [{ label: 'Under 5 lakh', min: null, max: 50_000_000, count: 12 }];
const any = { min: null, max: null };
type Range = { min: number | null; max: number | null };

describe('desktop rail and mobile sheet coexistence', () => {
  it.each(['price', 'km'])(
    'keeps the first %s selection checked when server results arrive',
    async (name) => {
      let apply: () => void = () => undefined;
      function Panels() {
        const [applied, setApplied] = useState<Range>(any);
        const [selected, setSelected] = useState<Range>(any);
        apply = () => setApplied(selected);
        const props = { name, bands, anyLabel: 'Any range', describe: () => 'Custom range' };
        return (
          <>
            <section aria-label="Desktop rail">
              <RangePresets
                {...props}
                idPrefix="filters"
                range={applied}
                onSelect={() => undefined}
              />
            </section>
            <section aria-label="Mobile sheet">
              <RangePresets
                {...props}
                idPrefix="sheet"
                range={selected}
                onSelect={(min, max) => setSelected({ min, max })}
              />
            </section>
          </>
        );
      }
      const user = userEvent.setup();
      render(<Panels />);
      const desktop = within(screen.getByRole('region', { name: 'Desktop rail' }));
      const mobile = within(screen.getByRole('region', { name: 'Mobile sheet' }));
      await user.click(mobile.getByRole('radio', { name: 'Under 5 lakh (12 cars)' }));
      expect(mobile.getByRole('radio', { name: 'Under 5 lakh (12 cars)' })).toBeChecked();
      act(() => apply());
      expect(desktop.getByRole('radio', { name: 'Under 5 lakh (12 cars)' })).toBeChecked();
      expect(mobile.getByRole('radio', { name: 'Under 5 lakh (12 cars)' })).toBeChecked();
      await user.click(mobile.getByRole('radio', { name: 'Any range' }));
      act(() => apply());
      expect(mobile.getByRole('radio', { name: 'Any range' })).toBeChecked();
      expect(desktop.getByRole('radio', { name: 'Any range' })).toBeChecked();
    },
  );
});
