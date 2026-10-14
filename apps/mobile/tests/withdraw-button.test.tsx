import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { WithdrawButton } from '../src/features/enquiries/withdraw-button';
import { ENQUIRY_TEXT } from '../src/features/enquiries/enquiries.constants';

let mockOwner = 'customer-one';
const mockWithdraw = jest.fn<Promise<{ withdrawn: boolean }>, [string, string, boolean]>(() =>
  Promise.resolve({ withdrawn: true }),
);
const mockManager = {
  token: () => 'T'.repeat(43),
  getSnapshot: () => ({ customer: { id: mockOwner } }),
  invalidate: jest.fn(() => Promise.resolve()),
};
jest.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ manager: mockManager }),
}));
jest.mock('../src/features/enquiries/enquiries-api', () => ({
  enquiriesApi: {
    withdraw: (token: string, id: string, grant: boolean) => mockWithdraw(token, id, grant),
  },
}));
const clients: QueryClient[] = [];
beforeEach(() => {
  mockOwner = 'customer-one';
  jest.clearAllMocks();
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});
async function button(grant = true) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <WithdrawButton id="permission-id" grant={grant} />
    </QueryClientProvider>,
  );
}
it('requires explicit confirmation and distinguishes dealership-wide withdrawal', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await button();
  await fireEvent.press(screen.getByRole('button', { name: ENQUIRY_TEXT.withdraw }));
  expect(mockWithdraw).not.toHaveBeenCalled();
  expect(alert.mock.calls[0]?.[1]).toBe(ENQUIRY_TEXT.withdrawBody);
  const confirm = alert.mock.calls[0]?.[2]?.find((item) => item.style === 'destructive');
  await act(async () => {
    confirm?.onPress?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(screen.getByText(ENQUIRY_TEXT.withdrawn)).toBeOnTheScreen());
  expect(mockWithdraw).toHaveBeenCalledWith('T'.repeat(43), 'permission-id', true);
});
it('does not carry a previous-account confirmation into another customer', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await button();
  await fireEvent.press(screen.getByRole('button', { name: ENQUIRY_TEXT.withdraw }));
  mockOwner = 'customer-two';
  const confirm = alert.mock.calls[0]?.[2]?.find((item) => item.style === 'destructive');
  await act(async () => {
    confirm?.onPress?.();
    await Promise.resolve();
  });
  expect(mockWithdraw).not.toHaveBeenCalled();
});
it('keeps legacy enquiry withdrawal scoped and never claims success on failure', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockWithdraw.mockRejectedValueOnce(new Error('Offline'));
  await button(false);
  await fireEvent.press(screen.getByRole('button', { name: ENQUIRY_TEXT.withdraw }));
  expect(alert.mock.calls[0]?.[1]).toBe(ENQUIRY_TEXT.legacyWithdrawBody);
  const confirm = alert.mock.calls[0]?.[2]?.find((item) => item.style === 'destructive');
  await act(async () => {
    confirm?.onPress?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => expect(screen.getByText('Offline')).toBeOnTheScreen());
  expect(screen.queryByText(ENQUIRY_TEXT.withdrawn)).toBeNull();
  expect(mockWithdraw).toHaveBeenCalledTimes(1);
});
