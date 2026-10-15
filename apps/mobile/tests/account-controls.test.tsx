import type * as ReactNativeModule from 'react-native';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { AccountScreen } from '../src/features/account/account-screen';
import { DeletionScreen } from '../src/features/account/deletion-screen';
import { ACCOUNT_TEXT } from '../src/features/account/account.constants';
import { ApiError } from '../src/services/api';
import { supportTicket } from './support-fixtures';

let mockSession = {
  status: 'authenticated',
  customer: { id: 'customer-one', fullName: 'Customer One', phoneDisplay: '+91 95566 00001' },
  error: null,
};
let mockFresh = true;
const mockRouter = {
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
};
const mockManager = {
  token: () => 'T'.repeat(43),
  expiresAt: () => '2030-01-01T00:00:00.000Z',
  getSnapshot: () => mockSession,
  invalidate: jest.fn(() => Promise.resolve()),
};
const mockDeactivate = jest.fn(() => Promise.resolve({ deactivated: true }));
const mockCreate = jest.fn(() => Promise.resolve(supportTicket));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ manager: mockManager }),
  useSession: () => mockSession,
}));
jest.mock('../src/features/account/account-api', () => ({
  accountApi: {
    status: () => Promise.resolve({ canDeactivate: mockFresh }),
    deactivate: () => mockDeactivate(),
  },
}));
jest.mock('../src/features/support/support-api', () => ({
  supportApi: { create: () => mockCreate() },
}));
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual<typeof ReactNativeModule>('react-native');
  return { __esModule: true, default: View, Path: View, SvgXml: View };
});
const clients: QueryClient[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  mockFresh = true;
  mockSession = { ...mockSession, customer: { ...mockSession.customer, id: 'customer-one' } };
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});
async function view(deletion = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      {deletion ? <DeletionScreen /> : <AccountScreen />}
    </QueryClientProvider>,
  );
}
it('requires a fresh capability and an unticked explicit deactivation choice', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await view();
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeOnTheScreen());
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('button', { name: ACCOUNT_TEXT.deactivate })).toBeDisabled();
  expect(mockDeactivate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByRole('button', { name: ACCOUNT_TEXT.deactivate }));
  await waitFor(() => expect(mockManager.invalidate).toHaveBeenCalledTimes(1));
  expect(alert).toHaveBeenCalledWith(ACCOUNT_TEXT.deactivated, ACCOUNT_TEXT.reactivationBody);
});
it('offers reauthentication rather than deactivation when the OTP proof is stale', async () => {
  mockFresh = false;
  await view();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: ACCOUNT_TEXT.freshOtp })).toBeOnTheScreen(),
  );
  expect(screen.queryByRole('checkbox')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: ACCOUNT_TEXT.freshOtp }));
  expect(mockRouter.navigate).toHaveBeenCalledWith('/sign-in');
  expect(mockDeactivate).not.toHaveBeenCalled();
});
it('does not report completion or sign out on uncertain deactivation', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockDeactivate.mockRejectedValueOnce(new ApiError('REQUEST_TIMEOUT', 'Timed out'));
  await view();
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByRole('button', { name: ACCOUNT_TEXT.deactivate }));
  await waitFor(() => expect(screen.getByText(ACCOUNT_TEXT.uncertain)).toBeOnTheScreen());
  expect(alert).not.toHaveBeenCalled();
  expect(mockManager.invalidate).not.toHaveBeenCalled();
  expect(mockDeactivate).toHaveBeenCalledTimes(1);
});
it('ignores a late previous-account success', async () => {
  let finish!: (result: { deactivated: boolean }) => void;
  mockDeactivate.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await view();
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByRole('button', { name: ACCOUNT_TEXT.deactivate }));
  mockSession = { ...mockSession, customer: { ...mockSession.customer, id: 'customer-two' } };
  await act(async () => {
    finish({ deactivated: true });
    await Promise.resolve();
  });
  expect(mockManager.invalidate).not.toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
});
it('distinguishes a confirmed deletion-request receipt from actual erasure', async () => {
  await view(true);
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('button', { name: ACCOUNT_TEXT.delete })).toBeDisabled();
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByRole('button', { name: ACCOUNT_TEXT.delete }));
  await waitFor(() =>
    expect(
      screen.getByText(ACCOUNT_TEXT.deletionReceived(supportTicket.reference)),
    ).toBeOnTheScreen(),
  );
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockManager.invalidate).not.toHaveBeenCalled();
});
