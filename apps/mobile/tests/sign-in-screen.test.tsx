import type * as ReactNativeModule from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type {
  LegalPublication,
  NativeOtpChallenge,
  NativeCustomerSignIn,
} from '@dealers-drive/contracts/native-auth';

import { SignInScreen } from '../src/features/auth/sign-in-screen';
import { AUTH_TEXT } from '../src/features/auth/auth.constants';

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true };
const mockManager = {
  beginAuthentication: jest.fn(() => 1),
  cancelAuthentication: jest.fn(),
  accept: jest.fn(() => Promise.resolve(true)),
};
const policies: LegalPublication = {
  state: 'DRAFT',
  collectionEnabled: true,
  documents: [
    {
      id: 'terms',
      title: 'Terms',
      version: 'test-terms-v1',
      digest: 'hash-terms',
      reviewed: false,
      effectiveDate: null,
      sections: [],
    },
    {
      id: 'privacy',
      title: 'Privacy',
      version: 'test-privacy-v1',
      digest: 'hash-privacy',
      reviewed: false,
      effectiveDate: null,
      sections: [],
    },
  ],
  sharing: null,
};
const challenge: NativeOtpChallenge = {
  challenge: 'signed-opaque-challenge',
  phoneDisplay: '+91 98455 99999',
  expiresAt: '2030-01-01T00:00:00.000Z',
  retryAt: '2030-01-01T00:00:00.000Z',
};
const mockApi = {
  publication: jest.fn(() => Promise.resolve(policies)),
  request: jest.fn(() => Promise.resolve(challenge)),
  resend: jest.fn(() => Promise.resolve(challenge)),
  verify: jest.fn<Promise<NativeCustomerSignIn>, [string, string, AbortSignal?]>(() =>
    Promise.resolve({
      status: 'NAME_REQUIRED',
      signUpToken: 'private-signup-ticket',
      expiresAt: '2030-01-01T00:00:00.000Z',
      phoneDisplay: challenge.phoneDisplay,
    }),
  ),
  reactivate: jest.fn(() =>
    Promise.resolve({
      customer: {
        id: '11111111-1111-4111-8111-111111111111',
        fullName: 'New Customer',
        phone: '+919845599999',
        phoneDisplay: challenge.phoneDisplay,
      },
      credential: { token: 'T'.repeat(43), expiresAt: '2030-01-01T00:00:00.000Z' },
    }),
  ),
  signUp: jest.fn(() =>
    Promise.resolve({
      customer: {
        id: '11111111-1111-4111-8111-111111111111',
        fullName: 'New Customer',
        phone: '+919845599999',
        phoneDisplay: challenge.phoneDisplay,
      },
      credential: { token: 'T'.repeat(43), expiresAt: '2030-01-01T00:00:00.000Z' },
    }),
  ),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ addListener: () => () => undefined }),
}));
jest.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ manager: mockManager, api: mockApi }),
}));
const clients: QueryClient[] = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  jest.useRealTimers();
});
async function form() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <SignInScreen />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(mockApi.publication).toHaveBeenCalled());
}
async function prove(reactivation = false) {
  await fireEvent.changeText(screen.getByLabelText(AUTH_TEXT.mobile), '9845599999');
  await fireEvent.press(screen.getByRole('button', { name: AUTH_TEXT.send }));
  await waitFor(() => expect(screen.getByLabelText(AUTH_TEXT.code)).toBeOnTheScreen());
  await fireEvent.changeText(screen.getByLabelText(AUTH_TEXT.code), '123456');
  await fireEvent.press(screen.getByRole('button', { name: AUTH_TEXT.verify }));
  await waitFor(() =>
    expect(
      reactivation
        ? screen.getByRole('button', { name: AUTH_TEXT.reactivate })
        : screen.getByLabelText(AUTH_TEXT.name),
    ).toBeOnTheScreen(),
  );
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
it('validates phone input, exposes country code and makes no invalid OTP request', async () => {
  await form();
  expect(screen.getByText(AUTH_TEXT.countryCode)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: AUTH_TEXT.send }));
  expect(screen.getByText(AUTH_TEXT.invalidPhone)).toBeOnTheScreen();
  expect(mockApi.request).not.toHaveBeenCalled();
});
it('keeps Terms acceptance and Privacy acknowledgment unticked and completes only after server success', async () => {
  await form();
  await prove();
  expect(
    screen.getByRole('checkbox', { name: AUTH_TEXT.acceptTerms, checked: false }),
  ).toBeOnTheScreen();
  expect(
    screen.getByRole('checkbox', { name: AUTH_TEXT.acknowledgePrivacy, checked: false }),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: AUTH_TEXT.create })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText(AUTH_TEXT.name), 'New Customer');
  await fireEvent.press(screen.getByRole('checkbox', { name: AUTH_TEXT.acceptTerms }));
  await fireEvent.press(screen.getByRole('checkbox', { name: AUTH_TEXT.acknowledgePrivacy }));
  await fireEvent.press(screen.getByRole('button', { name: AUTH_TEXT.create }));
  await waitFor(() => expect(mockManager.accept).toHaveBeenCalledTimes(1));
  expect(mockApi.signUp).toHaveBeenCalledWith(
    expect.objectContaining({
      fullName: 'New Customer',
      agreement: {
        version: 'test-terms-v1',
        accepted: true,
        privacyAcknowledged: true,
        privacyVersion: 'test-privacy-v1',
      },
    }),
    expect.any(AbortSignal),
  );
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
it('cancels the current generation and original pending action on explicit cancellation', async () => {
  await form();
  await fireEvent.press(screen.getByRole('button', { name: AUTH_TEXT.cancel }));
  expect(mockManager.cancelAuthentication).toHaveBeenCalledWith(1);
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockManager.accept).not.toHaveBeenCalled();
});
it('shows a failed signup without completing authentication or reporting success', async () => {
  mockApi.signUp.mockRejectedValueOnce(new Error('Server unavailable'));
  await form();
  await prove();
  await fireEvent.changeText(screen.getByLabelText(AUTH_TEXT.name), 'New Customer');
  await fireEvent.press(screen.getByRole('checkbox', { name: AUTH_TEXT.acceptTerms }));
  await fireEvent.press(screen.getByRole('checkbox', { name: AUTH_TEXT.acknowledgePrivacy }));
  await fireEvent.press(screen.getByRole('button', { name: AUTH_TEXT.create }));
  await waitFor(() => expect(screen.getByText('Server unavailable')).toBeOnTheScreen());
  expect(mockManager.accept).not.toHaveBeenCalled();
  expect(mockRouter.back).not.toHaveBeenCalled();
});

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual<typeof ReactNativeModule>('react-native');
  return { __esModule: true, default: View, Path: View, SvgXml: View };
});

it('requires explicit reactivation after verified OTP and never treats it as new signup', async () => {
  mockApi.verify.mockResolvedValueOnce({
    status: 'REACTIVATION_REQUIRED',
    reactivationToken: 'single-use-test-proof',
    expiresAt: '2030-01-01T00:00:00.000Z',
    phoneDisplay: challenge.phoneDisplay,
    fullName: 'New Customer',
  });
  await form();
  await prove(true);
  expect(mockManager.accept).not.toHaveBeenCalled();
  expect(mockApi.signUp).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: AUTH_TEXT.reactivate }));
  await waitFor(() => expect(mockManager.accept).toHaveBeenCalledTimes(1));
  expect(mockApi.reactivate).toHaveBeenCalledWith('single-use-test-proof', expect.anything());
});

it('normalises pasted country codes without truncating the subscriber number', async () => {
  await form();
  await fireEvent.changeText(screen.getByLabelText(AUTH_TEXT.mobile), '+91 98455 99999');
  await fireEvent.press(screen.getByRole('button', { name: AUTH_TEXT.send }));
  await waitFor(() =>
    expect(mockApi.request).toHaveBeenLastCalledWith('9845599999', expect.any(AbortSignal)),
  );
});
