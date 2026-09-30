import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VehicleName } from '@/components/vehicle/vehicle-name';

/**
 * The visible vehicle name on the card and the vehicle page: the year lives in
 * the plate beside it, so it is not drawn twice — but it stays in the
 * accessible name, where the plate is not.
 */
function link(title: string, year: number | null) {
  render(
    <h3>
      <VehicleName title={title} year={year} />
    </h3>,
  );
  return screen.getByRole('heading', { level: 3 });
}

describe('VehicleName', () => {
  it('shows the name without the year, and keeps the year for screen readers', () => {
    const anchor = link('2022 Maruti Suzuki Brezza ZXi', 2022);
    expect(anchor.querySelector('[data-slot="vehicle-name"]')).toHaveTextContent(
      /^Maruti Suzuki Brezza ZXi$/,
    );
    expect(anchor.querySelector('.sr-only')).toHaveTextContent(/^2022$/);
    expect(anchor).toHaveAccessibleName('2022 Maruti Suzuki Brezza ZXi');
  });

  it('draws a title with no year to drop exactly as it is, with nothing hidden', () => {
    const anchor = link('KA 01 AB 1234', 2022);
    expect(anchor).toHaveTextContent(/^KA 01 AB 1234$/);
    expect(anchor.querySelector('.sr-only')).toBeNull();
  });
});
