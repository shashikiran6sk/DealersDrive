import { fireEvent, render, screen } from '@testing-library/react-native';
import { PolicyChoice } from '../src/components/policy-choice';
import { AUTH_TEXT } from '../src/features/auth/auth.constants';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
it.each(['terms', 'privacy'] as const)(
  'opens authoritative %s without recording consent',
  async (kind) => {
    const change = jest.fn();
    await render(<PolicyChoice kind={kind} checked={false} onChange={change} />);
    const label = kind === 'terms' ? AUTH_TEXT.terms : AUTH_TEXT.privacy;
    await fireEvent.press(screen.getByRole('link', { name: `Read ${label}` }));
    expect(mockPush).toHaveBeenLastCalledWith(`/policy/${kind}`);
    expect(change).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('checkbox', { checked: false }));
    expect(change).toHaveBeenCalledTimes(1);
  },
);
