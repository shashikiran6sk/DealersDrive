import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type {
  CustomerSupportTicket,
  SupportMessageInput,
} from '@dealers-drive/contracts/support-client';
import { SupportDetailScreen } from '../src/features/support/support-detail-screen';
import { SUPPORT_TEXT } from '../src/features/support/support.constants';
import { ApiError } from '../src/services/api';
import { supportTicket } from './support-fixtures';

let mockFocused = true;
const mockOne = jest.fn(() => Promise.resolve(mockTicket));
let mockTicket = { ...supportTicket };
const mockSession = { status: 'authenticated', customer: { id: 'customer-one' }, error: null };
const mockManager = {
  token: () => 'T'.repeat(43),
  getSnapshot: () => mockSession,
  invalidate: jest.fn(() => Promise.resolve()),
};
const mockRouter = {
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
};
const mockReply = jest.fn<Promise<CustomerSupportTicket>, [string, string, SupportMessageInput]>(
  () => Promise.resolve({ ...mockTicket, remainingMessages: 4 }),
);
const mockReopen = jest.fn(() => {
  mockTicket = { ...supportTicket };
  return Promise.resolve(mockTicket);
});
jest.mock('expo-crypto', () => ({ randomUUID: () => '11111111-1111-4111-8111-111111111111' }));
jest.mock('expo-router', () => ({
  useIsFocused: () => mockFocused,
  useNavigation: () => ({ dispatch: jest.fn() }),
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: '11111111-1111-4111-8111-111111111111' }),
}));
jest.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ manager: mockManager }),
  useSession: () => mockSession,
}));
jest.mock('../src/features/support/support-api', () => ({
  supportApi: {
    one: () => mockOne(),
    reply: (token: string, id: string, input: SupportMessageInput) => mockReply(token, id, input),
    reopen: () => mockReopen(),
  },
}));
const clients: QueryClient[] = [];
beforeEach(() => {
  mockTicket = { ...supportTicket };
  mockFocused = true;
  jest.clearAllMocks();
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  jest.useRealTimers();
});
async function conversation() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const tree = () => (
    <QueryClientProvider client={client}>
      <SupportDetailScreen />
    </QueryClientProvider>
  );
  const view = await render(tree());
  await waitFor(() => expect(screen.getByText(mockTicket.description)).toBeOnTheScreen());
  return { view, tree };
}
it('keeps a quota-limited conversation focused instead of creating another request', async () => {
  mockTicket = { ...supportTicket, canReply: false, remainingMessages: 0 };
  await conversation();
  expect(screen.getByText(SUPPORT_TEXT.limited)).toBeOnTheScreen();
  expect(screen.queryByLabelText(SUPPORT_TEXT.reply)).toBeNull();
  expect(mockReply).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: SUPPORT_TEXT.create })).toBeNull();
});
it('requires explicit reopen for resolved requests and never reopens closed history', async () => {
  mockTicket = { ...supportTicket, status: 'RESOLVED', canReply: false, canReopen: true };
  await conversation();
  expect(screen.queryByLabelText(SUPPORT_TEXT.reply)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: SUPPORT_TEXT.reopen }));
  await waitFor(() => expect(screen.getByLabelText(SUPPORT_TEXT.reply)).toBeOnTheScreen());
  expect(mockReopen).toHaveBeenCalledTimes(1);
});
it('retains a message retry id for unchanged text and confirms state only on server success', async () => {
  mockReply.mockRejectedValueOnce(new ApiError('REQUEST_TIMEOUT', 'Timed out'));
  await conversation();
  await fireEvent.changeText(screen.getByLabelText(SUPPORT_TEXT.reply), 'A customer reply');
  await fireEvent.press(screen.getByRole('button', { name: SUPPORT_TEXT.send }));
  await waitFor(() => expect(screen.getByText(SUPPORT_TEXT.replyUncertain)).toBeOnTheScreen());
  expect(screen.getByLabelText(SUPPORT_TEXT.reply)).toHaveProp('value', 'A customer reply');
  await fireEvent.press(screen.getByRole('button', { name: SUPPORT_TEXT.send }));
  await waitFor(() => expect(screen.getByLabelText(SUPPORT_TEXT.reply)).toHaveProp('value', ''));
  expect(mockReply.mock.calls[0]?.[2].clientMessageId).toBe(
    mockReply.mock.calls[1]?.[2].clientMessageId,
  );
  expect(screen.getByText(SUPPORT_TEXT.remaining(4))).toBeOnTheScreen();
});
it('shows closed history with a new-request action and no reply/reopen controls', async () => {
  mockTicket = { ...supportTicket, status: 'CLOSED', canReply: false };
  await conversation();
  expect(screen.getByText(SUPPORT_TEXT.closed)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: SUPPORT_TEXT.create })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: SUPPORT_TEXT.reopen })).toBeNull();
  expect(screen.queryByLabelText(SUPPORT_TEXT.reply)).toBeNull();
});

it('polls only a focused foreground conversation', async () => {
  jest.useFakeTimers();
  mockFocused = false;
  const h = await conversation();
  expect(mockOne).toHaveBeenCalledTimes(1);
  await act(() => jest.advanceTimersByTimeAsync(16000));
  expect(mockOne).toHaveBeenCalledTimes(1);
  mockFocused = true;
  await h.view.rerender(h.tree());
  await act(() => jest.advanceTimersByTimeAsync(16000));
  expect(mockOne).toHaveBeenCalledTimes(2);
});
