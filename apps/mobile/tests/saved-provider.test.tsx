import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { SavedProvider, useSaved } from '../src/features/saved/saved-provider';
import { PendingActions } from '../src/features/auth/pending-action';
import { ApiError } from '../src/services/api';

let mockSession = {
  status: 'authenticated',
  customer: {
    id: 'customer-one',
    fullName: 'One',
    phone: '+919845599999',
    phoneDisplay: '+91 98455 99999',
  },
  error: null,
};
let mockToken = 'A'.repeat(43);
let mockState: string[] = [];
const mockRouter = { navigate: jest.fn() };
const mockManager = {
  pending: new PendingActions(),
  token: () => mockToken,
  getSnapshot: () => mockSession,
  invalidate: jest.fn(() => Promise.resolve()),
};
const mockHydrate = jest.fn(() => Promise.resolve([...mockState]));
const mockSet = jest.fn((token: string, slug: string, saved: boolean) => {
  void token;
  mockState = saved
    ? [...new Set([...mockState, slug])]
    : mockState.filter((value) => value !== slug);
  return Promise.resolve({ slug, saved });
});
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ manager: mockManager }),
  useSession: () => mockSession,
}));
jest.mock('../src/features/saved/saved-api', () => ({
  hydrateSavedSlugs: () => mockHydrate(),
  savedApi: { set: (token: string, slug: string, saved: boolean) => mockSet(token, slug, saved) },
}));
function Probe() {
  const saved = useSaved();
  return (
    <>
      <Text>{saved.ready ? 'ready' : 'loading'}</Text>
      <Text>{saved.isSaved('car-one') ? 'saved' : 'unsaved'}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Toggle saved car"
        onPress={() => saved.toggle('car-one')}
      >
        <Text>Toggle</Text>
      </Pressable>
    </>
  );
}
const clients: QueryClient[] = [];
beforeEach(() => {
  mockState = [];
  mockToken = 'A'.repeat(43);
  mockSession = { ...mockSession, customer: { ...mockSession.customer, id: 'customer-one' } };
  mockManager.pending.clear();
  jest.clearAllMocks();
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});
async function provider() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const tree = (
    <QueryClientProvider client={client}>
      <SavedProvider>
        <Probe />
      </SavedProvider>
    </QueryClientProvider>
  );
  const view = await render(tree);
  await waitFor(() => expect(screen.getByText('ready')).toBeOnTheScreen());
  return { view, client, tree };
}
it('resumes the authenticated save intent once using a positive server save', async () => {
  const action = mockManager.pending.request({ kind: 'save', slug: 'car-one' });
  mockManager.pending.bind('customer-one');
  const h = await provider();
  await waitFor(() => expect(mockSet).toHaveBeenCalledTimes(1));
  expect(mockSet).toHaveBeenCalledWith('A'.repeat(43), 'car-one', true);
  await waitFor(() => expect(screen.getByText('saved')).toBeOnTheScreen());
  await h.view.rerender(h.tree);
  expect(mockSet).toHaveBeenCalledTimes(1);
  expect(mockManager.pending.consume(action.id, 'customer-one')).toBeNull();
});
it('locks repeated taps until the confirmed server mutation settles', async () => {
  let release!: (value: { slug: string; saved: boolean }) => void;
  mockSet.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await provider();
  await fireEvent.press(screen.getByRole('button', { name: 'Toggle saved car' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Toggle saved car' }));
  expect(mockSet).toHaveBeenCalledTimes(1);
  mockState = ['car-one'];
  release({ slug: 'car-one', saved: true });
  await waitFor(() => expect(screen.getByText('saved')).toBeOnTheScreen());
});
it('does not let a late old-account unauthorized response invalidate the new customer', async () => {
  let reject!: (error: Error) => void;
  mockSet.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const h = await provider();
  await fireEvent.press(screen.getByRole('button', { name: 'Toggle saved car' }));
  mockSession = { ...mockSession, customer: { ...mockSession.customer, id: 'customer-two' } };
  mockToken = 'B'.repeat(43);
  await h.view.rerender(h.tree);
  reject(new ApiError('AUTH_REQUIRED', 'Expired', 401));
  await waitFor(() => expect(mockHydrate).toHaveBeenCalled());
  expect(mockManager.invalidate).not.toHaveBeenCalled();
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});
