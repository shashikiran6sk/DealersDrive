import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceLocationFields } from '@/components/forms/service-location-fields/service-location-fields';
import { loadServiceLocationsAction } from '@/features/service-location-actions';

vi.mock('@/features/service-location-actions', () => ({ loadServiceLocationsAction: vi.fn() }));
const district = (name: string, stateId = 'IN-TN') => ({
  id: `${stateId}-${name}`,
  stateId,
  name,
  sourceUrl: 'https://district.nic.in/',
  active: true,
  onboardingEnabled: true,
  photographyAvailable: false,
  version: 1,
});
beforeEach(() => {
  vi.mocked(loadServiceLocationsAction).mockResolvedValue({
    data: [
      {
        id: 'IN-TN',
        name: 'Tamil Nadu',
        kind: 'STATE',
        active: true,
        onboardingEnabled: true,
        version: 1,
        districts: [district('Vellore'), district('Chennai')],
      },
      {
        id: 'IN-KA',
        name: 'Karnataka',
        kind: 'STATE',
        active: true,
        onboardingEnabled: true,
        version: 1,
        districts: [district('Reviewed District', 'IN-KA')],
      },
    ],
  });
});
function form(initialState = '', initialDistrict = '') {
  return render(
    <form data-testid="location-form">
      <ServiceLocationFields initialState={initialState} initialDistrict={initialDistrict} />
    </form>,
  );
}
describe('canonical location fields', () => {
  it('shows the first selected state and district immediately and submits their canonical names', async () => {
    const user = userEvent.setup();
    form();
    const state = screen.getByLabelText('State');
    await waitFor(() => expect(state).toBeEnabled());
    await user.selectOptions(state, 'Tamil Nadu');
    expect(state).toHaveValue('Tamil Nadu');
    const input = screen.getByRole('combobox', { name: 'District' });
    await user.type(input, 'Vell');
    await user.click(screen.getByRole('button', { name: 'Vellore' }));
    expect(input).toHaveValue('Vellore');
    const data = new FormData(screen.getByTestId<HTMLFormElement>('location-form'));
    expect(data.get('state')).toBe('Tamil Nadu');
    expect(data.get('district')).toBe('Vellore');
  });
  it('supports keyboard search and selection, and Escape closes the list', async () => {
    const user = userEvent.setup();
    form('Tamil Nadu');
    const input = screen.getByRole('combobox', { name: 'District' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, 'Chen');
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('Chennai');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.click(input);
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });
  it('clears the previous district when the state changes and shows only matching districts', async () => {
    const user = userEvent.setup();
    form('Tamil Nadu', 'Vellore');
    await waitFor(() => expect(screen.getByLabelText('State')).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('State'), 'Karnataka');
    const input = screen.getByRole('combobox', { name: 'District' });
    expect(input).toHaveValue('');
    await user.click(input);
    expect(screen.queryByRole('button', { name: 'Vellore' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reviewed District' })).toBeInTheDocument();
  });
  it('never submits typed unmatched text as a selected district', async () => {
    const user = userEvent.setup();
    form('Tamil Nadu', 'Vellore');
    const input = screen.getByRole('combobox', { name: 'District' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.clear(input);
    await user.type(input, 'Unlisted District');
    expect(new FormData(screen.getByTestId<HTMLFormElement>('location-form')).get('district')).toBe(
      '',
    );
    expect(screen.getByText('No available districts match.')).toBeInTheDocument();
  });
  it('preserves a legacy disabled location for unrelated edits without offering it to new dealers', async () => {
    form('Legacy State', 'Legacy District');
    await waitFor(() => expect(screen.getByLabelText('State')).toBeEnabled());
    expect(screen.getByRole('combobox', { name: 'District' })).toHaveValue('Legacy District');
    expect(screen.getByRole('combobox', { name: 'District' })).toBeDisabled();
    expect(new FormData(screen.getByTestId<HTMLFormElement>('location-form')).get('district')).toBe(
      'Legacy District',
    );
  });
  it('fails closed with a visible recovery message when the catalogue cannot be loaded', async () => {
    vi.mocked(loadServiceLocationsAction).mockRejectedValue(new Error('offline'));
    form();
    expect(await screen.findByRole('alert')).toHaveTextContent('Reload this page');
    expect(screen.getByLabelText('State')).toBeDisabled();
  });
});
