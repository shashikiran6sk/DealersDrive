import type * as ReactNativeModule from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { LegalPublication } from '@dealers-drive/contracts/native-auth';
import type { EnquiryReceipt } from '@dealers-drive/contracts/enquiry-client';
import { EnquiryScreen } from '../src/features/enquiries/enquiry-screen';
import { PendingActions } from '../src/features/auth/pending-action';
import { ENQUIRY_TEXT } from '../src/features/enquiries/enquiries.constants';
import { ApiError } from '../src/services/api';

const mockPublication: LegalPublication = {
  state: 'DRAFT',
  collectionEnabled: true,
  documents: [],
  sharing: { version: 'test-sharing-v1', text: 'Sharing details', digest: 'hash' },
};
let mockRequired = true;
let mockSession = {
  status: 'authenticated',
  customer: {
    id: 'customer-one',
    fullName: 'Customer One',
    phone: '+919845599999',
    phoneDisplay: '+91 98455 99999',
  },
  error: null,
};
const mockRouter = {
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
};
const mockManager = {
  pending: new PendingActions(),
  token: () => (mockSession.status === 'authenticated' ? 'T'.repeat(43) : null),
  getSnapshot: () => mockSession,
  invalidate: jest.fn(() => Promise.resolve()),
};
const mockAuthApi = { publication: jest.fn(() => Promise.resolve(mockPublication)) };
const mockApi = {
  sharing: jest.fn(() =>
    Promise.resolve({
      required: mockRequired,
      recipientId: '11111111-1111-4111-8111-111111111111',
      dealerName: 'Dealer One',
    }),
  ),
  create: jest.fn<Promise<EnquiryReceipt>, [string, unknown]>(() =>
    Promise.resolve({
      id: 'receipt',
      status: 'NEW',
      createdAt: '2030-01-01T00:00:00.000Z',
      dealerName: 'Dealer One',
      vehicleTitle: 'Car One',
    }),
  ),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ slug: 'car-one' }),
  useNavigation: () => ({ dispatch: jest.fn(), addListener: () => () => undefined }),
}));
jest.mock('../src/features/cars/cars-api', () => ({
  carsApi: { detail: () => Promise.resolve({ title: 'Car One' }) },
}));
jest.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ manager: mockManager, api: mockAuthApi }),
  useSession: () => mockSession,
}));
jest.mock('../src/features/enquiries/enquiries-api', () => ({
  enquiriesApi: {
    sharing: () => mockApi.sharing(),
    create: (token: string, input: unknown) => mockApi.create(token, input),
  },
}));
const clients: QueryClient[] = [];
beforeEach(() => {
  mockRequired = true;
  mockSession = {
    ...mockSession,
    status: 'authenticated',
    customer: { ...mockSession.customer, id: 'customer-one' },
  };
  mockManager.pending.clear();
  jest.clearAllMocks();
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});
async function form() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const tree = (
    <QueryClientProvider client={client}>
      <EnquiryScreen />
    </QueryClientProvider>
  );
  const view = await render(tree);
  return { view, tree };
}
it('resumes an enquiry intent to a fresh unticked form and never automatically submits', async () => {
  mockManager.pending.request({ kind: 'enquiry', slug: 'car-one' });
  mockManager.pending.bind('customer-one');
  await form();
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeOnTheScreen());
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(mockApi.create).not.toHaveBeenCalled();
  expect(mockManager.pending.peek()).toBeNull();
  expect(screen.getByRole('button', { name: ENQUIRY_TEXT.send })).toBeDisabled();
});
it('reuses existing same-dealer permission and requires only an explicit send', async () => {
  mockRequired = false;
  await form();
  await waitFor(() => expect(screen.getByText('Dealer One')).toBeOnTheScreen());
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(mockApi.create).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: ENQUIRY_TEXT.send }));
  await waitFor(() => expect(screen.getByText(ENQUIRY_TEXT.sent)).toBeOnTheScreen());
  expect(mockApi.create).toHaveBeenCalledWith('T'.repeat(43), {
    listingSlug: 'car-one',
    message: undefined,
    recipientId: '11111111-1111-4111-8111-111111111111',
  });
});
it('locks repeated submits and sends the current explicit new-dealer permission once', async () => {
  let finish!: (value: EnquiryReceipt) => void;
  mockApi.create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await form();
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByRole('button', { name: ENQUIRY_TEXT.send }));
  await waitFor(() => expect(mockApi.create).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByRole('button', { name: ENQUIRY_TEXT.send }));
  expect(mockApi.create).toHaveBeenCalledTimes(1);
  expect(mockApi.create.mock.calls[0]?.[1]).toMatchObject({
    sharing: { version: 'test-sharing-v1', granted: true },
  });
  await act(async () => {
    finish({
      id: 'receipt',
      status: 'NEW',
      createdAt: '2030-01-01T00:00:00.000Z',
      dealerName: 'Dealer One',
      vehicleTitle: 'Car One',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  await waitFor(() => expect(screen.getByText(ENQUIRY_TEXT.sent)).toBeOnTheScreen());
});
it('rejects a changed receiver during preflight and requires a fresh choice', async () => {
  await form();
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('checkbox'));
  mockApi.sharing.mockResolvedValueOnce({
    required: true,
    recipientId: '22222222-2222-4222-8222-222222222222',
    dealerName: 'Dealer Two',
  });
  await fireEvent.press(screen.getByRole('button', { name: ENQUIRY_TEXT.send }));
  await waitFor(() => expect(screen.getByText(ENQUIRY_TEXT.changed)).toBeOnTheScreen());
  expect(mockApi.create).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});
it('never claims success or replays a mutation when delivery is uncertain', async () => {
  mockRequired = false;
  mockApi.create.mockRejectedValueOnce(new ApiError('REQUEST_TIMEOUT', 'Timed out'));
  await form();
  await waitFor(() => expect(screen.getByText('Dealer One')).toBeOnTheScreen());
  await fireEvent.press(screen.getByRole('button', { name: ENQUIRY_TEXT.send }));
  await waitFor(() => expect(screen.getByText(ENQUIRY_TEXT.uncertain)).toBeOnTheScreen());
  expect(mockApi.create).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(ENQUIRY_TEXT.sent)).toBeNull();
});
it('clears account-specific form state and ignores a late old-account success', async () => {
  mockRequired = false;
  let finish!: (value: EnquiryReceipt) => void;
  mockApi.create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const h = await form();
  await waitFor(() => expect(screen.getByText('Dealer One')).toBeOnTheScreen());
  await fireEvent.changeText(
    screen.getByLabelText(ENQUIRY_TEXT.message),
    'Private previous-account message',
  );
  await fireEvent.press(screen.getByRole('button', { name: ENQUIRY_TEXT.send }));
  await waitFor(() => expect(mockApi.create).toHaveBeenCalledTimes(1));
  mockSession = {
    ...mockSession,
    customer: { ...mockSession.customer, id: 'customer-two', fullName: 'Customer Two' },
  };
  await h.view.rerender(h.tree);
  await act(async () => {
    finish({
      id: 'receipt',
      status: 'NEW',
      createdAt: '2030-01-01T00:00:00.000Z',
      dealerName: 'Dealer One',
      vehicleTitle: 'Car One',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  await waitFor(() => expect(screen.getByText('Customer Two')).toBeOnTheScreen());
  expect(screen.getByLabelText(ENQUIRY_TEXT.message)).toHaveProp('value', '');
  expect(screen.queryByText(ENQUIRY_TEXT.sent)).toBeNull();
});

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual<typeof ReactNativeModule>('react-native');
  return { __esModule: true, default: View, Path: View, SvgXml: View };
});
