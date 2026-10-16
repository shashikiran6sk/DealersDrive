import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type {
  CreateSupportTicketInput,
  CustomerSupportTicket,
} from '@dealers-drive/contracts/support-client';
import { SupportCreateScreen } from '../src/features/support/support-create-screen';
import { SUPPORT_TEXT } from '../src/features/support/support.constants';
import {
  SUPPORT_CATEGORY_LABELS,
  SupportTicketCategory,
} from '@dealers-drive/contracts/support-client';
import { ApiError } from '../src/services/api';
import { supportTicket } from './support-fixtures';

let mockSession = { status: 'authenticated', customer: { id: 'customer-one' }, error: null };
const mockRouter = {
  navigate: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: () => true,
};
const mockManager = {
  token: () => 'T'.repeat(43),
  getSnapshot: () => mockSession,
  invalidate: jest.fn(() => Promise.resolve()),
};
const mockCreate = jest.fn<Promise<CustomerSupportTicket>, [string, CreateSupportTicketInput]>(() =>
  Promise.resolve(supportTicket),
);
let mockParams: { category?: string; subject?: string; enquiryId?: string } = {
  category: 'ACCOUNT_ISSUE',
  subject: 'Privacy request',
};
let mockUuid = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid).padStart(12, '0')}`,
}));
jest.mock('expo-router', () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../src/features/auth/auth-provider', () => ({
  useAuth: () => ({ manager: mockManager }),
  useSession: () => mockSession,
}));
jest.mock('../src/features/support/support-api', () => ({
  supportApi: {
    create: (token: string, input: CreateSupportTicketInput) => mockCreate(token, input),
  },
}));
const clients: QueryClient[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { category: 'ACCOUNT_ISSUE', subject: 'Privacy request' };
  mockSession = { ...mockSession, customer: { id: 'customer-one' } };
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
      <SupportCreateScreen />
    </QueryClientProvider>
  );
  const view = await render(tree);
  return { view, tree, client };
}
it('submits a validated privacy request without requiring new Terms acceptance', async () => {
  await form();
  await fireEvent.changeText(
    screen.getByLabelText(SUPPORT_TEXT.description),
    'Please help me with access to my personal data.',
  );
  await fireEvent.press(screen.getByRole('button', { name: SUPPORT_TEXT.create }));
  await waitFor(() =>
    expect(mockRouter.replace).toHaveBeenCalledWith(`/support-requests/${supportTicket.id}`),
  );
  expect(mockCreate.mock.calls[0]?.[1]).toMatchObject({
    category: 'ACCOUNT_ISSUE',
    subject: 'Privacy request',
    description: 'Please help me with access to my personal data.',
  });
  expect(mockCreate.mock.calls[0]?.[1].clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
});
it('keeps the same payload-bound id for an explicit retry after a lost response', async () => {
  mockCreate.mockRejectedValueOnce(new ApiError('REQUEST_TIMEOUT', 'Timed out'));
  await form();
  await fireEvent.changeText(
    screen.getByLabelText(SUPPORT_TEXT.description),
    'Please help me with access to my personal data.',
  );
  await fireEvent.press(screen.getByRole('button', { name: SUPPORT_TEXT.create }));
  await waitFor(() => expect(screen.getByText(SUPPORT_TEXT.createUncertain)).toBeOnTheScreen());
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(mockCreate).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: SUPPORT_TEXT.create }));
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
  expect(mockCreate.mock.calls[1]?.[1].clientRequestId).toBe(
    mockCreate.mock.calls[0]?.[1].clientRequestId,
  );
});
it('clears private drafts on account switch and refuses invalid descriptions before API submission', async () => {
  const h = await form();
  await fireEvent.changeText(
    screen.getByLabelText(SUPPORT_TEXT.description),
    'Previous-account private complaint',
  );
  mockSession = { ...mockSession, customer: { id: 'customer-two' } };
  await h.view.rerender(
    <QueryClientProvider client={h.client}>
      <SupportCreateScreen />
    </QueryClientProvider>,
  );
  expect(screen.getByLabelText(SUPPORT_TEXT.description)).toHaveProp('value', '');
  await fireEvent.press(screen.getByRole('button', { name: SUPPORT_TEXT.create }));
  expect(mockCreate).not.toHaveBeenCalled();
});

it('requires an API-supported category and applies the native selector choice', async () => {
  mockParams = {};
  await form();
  await fireEvent.press(screen.getByRole('button', { name: SUPPORT_TEXT.create }));
  expect(screen.getByText('Choose an issue category.')).toBeOnTheScreen();
  expect(mockCreate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Category: Choose an issue category' }));
  for (const category of SupportTicketCategory.options)
    expect(
      screen.getByRole('radio', { name: SUPPORT_CATEGORY_LABELS[category] }),
    ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: SUPPORT_CATEGORY_LABELS.ACCOUNT_ISSUE }));
  expect(screen.queryByTestId('selection-sheet')).not.toBeOnTheScreen();
  expect(
    screen.getByRole('button', { name: `Category: ${SUPPORT_CATEGORY_LABELS.ACCOUNT_ISSUE}` }),
  ).toBeOnTheScreen();
});
