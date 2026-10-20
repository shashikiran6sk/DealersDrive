import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CUSTOMER_ACCOUNT_TEXT, CustomerDeletionRequestInput } from '@dealers-drive/contracts';
import { AccountControlsHost } from '../../../src/features/account/account-controls-host';
import { DeletionRequest } from '../../../src/features/account/deletion-request';
import { CustomerReactivation } from '../../../src/features/auth/customer-reactivation';
import {
  deactivateCustomerAction,
  requestCustomerDeletionAction,
} from '../../../src/features/account/account-actions';
import { customerReactivateAction } from '../../../src/features/auth/sign-in-actions';

vi.mock('../../../src/features/account/account-actions', () => ({
  deactivateCustomerAction: vi.fn(),
  requestCustomerDeletionAction: vi.fn(),
}));
vi.mock('../../../src/features/auth/sign-in-actions', () => ({
  customerReactivateAction: vi.fn(),
}));
const one = '11111111-1111-4111-8111-111111111111';
const two = '22222222-2222-4222-8222-222222222222';
beforeEach(() => vi.clearAllMocks());
describe('separate customer account controls', () => {
  it('requires an explicit unticked choice and preserves a confirmed receipt through logout refresh', async () => {
    const user = userEvent.setup();
    vi.mocked(deactivateCustomerAction).mockResolvedValue({ done: true });
    const view = render(<AccountControlsHost customerId={one} canDeactivate />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: CUSTOMER_ACCOUNT_TEXT.deactivate })).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: CUSTOMER_ACCOUNT_TEXT.deactivate }));
    await screen.findByRole('status');
    expect(deactivateCustomerAction).toHaveBeenCalledWith(true, one);
    view.rerender(<AccountControlsHost customerId={null} canDeactivate={false} />);
    expect(screen.getByRole('status')).toHaveTextContent(CUSTOMER_ACCOUNT_TEXT.deactivated);
  });
  it('clears a prior customer choice before rendering another account', async () => {
    const user = userEvent.setup();
    const view = render(<AccountControlsHost customerId={one} canDeactivate />);
    await user.click(screen.getByRole('checkbox'));
    view.rerender(<AccountControlsHost customerId={two} canDeactivate />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(deactivateCustomerAction).not.toHaveBeenCalled();
  });
  it('requires reauthentication when capability is stale and reports refusal without success', async () => {
    const user = userEvent.setup();
    vi.mocked(deactivateCustomerAction).mockResolvedValue({ error: 'Verify again', reauth: true });
    render(<AccountControlsHost customerId={one} canDeactivate />);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: CUSTOMER_ACCOUNT_TEXT.deactivate }));
    await screen.findByText('Verify again');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('link', { name: CUSTOMER_ACCOUNT_TEXT.freshOtp })).toHaveAttribute(
      'href',
      '/login?returnTo=%2Faccount',
    );
  });
  it('submits an owned deletion request and labels it as intake rather than erasure', async () => {
    const user = userEvent.setup();
    vi.mocked(requestCustomerDeletionAction).mockResolvedValue({ reference: 'DD-2001' });
    render(<DeletionRequest customerId={one} />);
    expect(screen.getByRole('button', { name: CUSTOMER_ACCOUNT_TEXT.delete })).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: CUSTOMER_ACCOUNT_TEXT.delete }));
    await screen.findByRole('status');
    expect(screen.getByRole('status')).toHaveTextContent(
      CUSTOMER_ACCOUNT_TEXT.deletionReceived('DD-2001'),
    );
    const draft = CustomerDeletionRequestInput.parse(
      vi.mocked(requestCustomerDeletionAction).mock.calls[0]?.[0],
    );
    expect(draft).toMatchObject({
      confirmed: true,
      message: '',
      expectedAccountId: one,
    });
    expect(draft.clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('does not activate an OTP-verified deactivated customer until explicit confirmation', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    vi.mocked(customerReactivateAction).mockResolvedValue({ done: true });
    render(
      <CustomerReactivation
        flowId={one}
        phoneDisplay="+91 95566 00001"
        onDone={onDone}
        onRestart={vi.fn()}
      />,
    );
    expect(customerReactivateAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: CUSTOMER_ACCOUNT_TEXT.reactivate }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(customerReactivateAction).toHaveBeenCalledWith(one);
  });
});
