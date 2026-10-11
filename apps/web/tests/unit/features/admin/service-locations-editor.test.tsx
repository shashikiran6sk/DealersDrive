import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceLocationsEditor } from '@/features/admin/service-locations-editor';
import {
  addServiceDistrictAction,
  updateServiceLocationAction,
} from '@/features/admin/service-location-actions';

vi.mock('@/features/admin/service-location-actions', () => ({
  addServiceDistrictAction: vi.fn(),
  updateServiceLocationAction: vi.fn(),
}));
const initial = {
  data: [
    {
      id: 'IN-TN',
      name: 'Tamil Nadu',
      kind: 'STATE' as const,
      active: true,
      onboardingEnabled: true,
      version: 1,
      districts: [
        {
          id: 'IN-TN-VELLORE',
          stateId: 'IN-TN',
          name: 'Vellore',
          sourceUrl: 'https://vellore.nic.in/',
          active: true,
          onboardingEnabled: true,
          photographyAvailable: false,
          version: 1,
        },
      ],
    },
    {
      id: 'IN-KA',
      name: 'Karnataka',
      kind: 'STATE' as const,
      active: true,
      onboardingEnabled: false,
      version: 1,
      districts: [],
    },
  ],
};
beforeEach(() => {
  vi.mocked(updateServiceLocationAction).mockResolvedValue({ ok: true, data: initial });
  vi.mocked(addServiceDistrictAction).mockResolvedValue({ ok: true, data: initial });
});
describe('admin location configuration', () => {
  it('shows recorded changes with readable settings while excluding unknown private metadata', () => {
    render(
      <ServiceLocationsEditor
        initial={initial}
        history={{
          data: [
            {
              id: '1',
              action: 'service_location.updated',
              entityId: 'IN-TN',
              at: '2026-10-10T00:00:00.000Z',
              before: { onboardingEnabled: true, privateToken: 'do-not-render' },
              after: { onboardingEnabled: false },
            },
          ],
        }}
      />,
    );
    expect(screen.getByText(/Before: New onboarding: Enabled/)).toBeInTheDocument();
    expect(screen.getByText(/After: New onboarding: Disabled/)).toBeInTheDocument();
    expect(screen.queryByText(/do-not-render/)).not.toBeInTheDocument();
  });
  it('keeps district photography independent and sends versioned district changes', async () => {
    const user = userEvent.setup();
    render(<ServiceLocationsEditor initial={initial} history={{ data: [] }} />);
    const form = screen.getByRole('button', { name: 'Save district' }).closest('form');
    expect(form).toBeTruthy();
    const fields = within(form!);
    expect(fields.getByLabelText('Photography coverage')).not.toBeChecked();
    await user.click(fields.getByLabelText('New onboarding'));
    await user.click(fields.getByRole('button', { name: 'Save district' }));
    await waitFor(() =>
      expect(updateServiceLocationAction).toHaveBeenCalledWith('district', 'IN-TN-VELLORE', {
        expectedVersion: 1,
        active: true,
        onboardingEnabled: false,
        photographyAvailable: false,
      }),
    );
  });
  it('enables a future state without activating districts', async () => {
    const user = userEvent.setup();
    render(<ServiceLocationsEditor initial={initial} history={{ data: [] }} />);
    await user.selectOptions(screen.getByLabelText('Configured state or Union Territory'), 'IN-KA');
    expect(screen.getByText(/0 configured districts/)).toBeInTheDocument();
    await user.click(screen.getByLabelText('New onboarding'));
    await user.click(screen.getByRole('button', { name: 'Save state' }));
    await waitFor(() =>
      expect(updateServiceLocationAction).toHaveBeenCalledWith('state', 'IN-KA', {
        expectedVersion: 1,
        active: true,
        onboardingEnabled: true,
      }),
    );
  });
  it('shows a stale-version refusal without reporting success', async () => {
    vi.mocked(updateServiceLocationAction).mockResolvedValue({
      ok: false,
      message: 'Another administrator changed this location. Reload before saving.',
    });
    const user = userEvent.setup();
    render(<ServiceLocationsEditor initial={initial} history={{ data: [] }} />);
    await user.click(screen.getByRole('button', { name: 'Save state' }));
    expect(await screen.findByText(/Another administrator changed/)).toBeInTheDocument();
    expect(screen.queryByText(/Service locations saved/)).not.toBeInTheDocument();
  });
  it('records explicit government-source review for a new canonical district', async () => {
    const user = userEvent.setup();
    render(<ServiceLocationsEditor initial={initial} history={{ data: [] }} />);
    await user.selectOptions(screen.getByLabelText('Configured state or Union Territory'), 'IN-KA');
    await user.click(screen.getByText('Add a government-reviewed district'));
    await user.type(screen.getByLabelText('Canonical district name'), 'Reviewed District');
    await user.type(screen.getByLabelText('Government source URL'), 'https://district.nic.in/');
    await user.click(screen.getByLabelText(/I checked the district/));
    await user.click(screen.getByRole('button', { name: 'Add district' }));
    await waitFor(() =>
      expect(addServiceDistrictAction).toHaveBeenCalledWith({
        stateId: 'IN-KA',
        name: 'Reviewed District',
        sourceUrl: 'https://district.nic.in/',
        sourceReviewed: true,
      }),
    );
  });
});
