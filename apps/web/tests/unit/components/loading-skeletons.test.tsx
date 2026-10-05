import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConsolePageLoading } from '@/components/dealer/console-page-loading';
import { DealerPageLoading } from '@/components/dealers/dealer-page-loading';
import { VehiclePageLoading } from '@/components/vehicle/vehicle-page-loading';
import { CustomerEnquiriesLoading } from '@/features/enquiry/customer-enquiries';
import { SavedListLoading } from '@/features/saved/saved-list';

/**
 * The `loading.tsx` skeletons. Each is what a person sees between the click
 * and the server's answer, so each is announced as a status and laid out on
 * the page's own grid, so the content lands where the skeleton was.
 */
describe.each([
  ['the dealer console', ConsolePageLoading, 'Loading the page'],
  ['a car', VehiclePageLoading, 'Loading the car'],
  ['a dealership', DealerPageLoading, 'Loading the dealership'],
  ['my enquiries', CustomerEnquiriesLoading, 'Loading your enquiries'],
  ['saved cars', SavedListLoading, 'Loading your saved cars'],
])('the skeleton for %s', (_name, Skeleton, label) => {
  it('announces itself as loading and marks itself for the page that replaces it', () => {
    render(<Skeleton />);
    const status = screen.getByRole('status', { name: label });
    expect(status).toHaveAttribute('data-loading');
  });
});
