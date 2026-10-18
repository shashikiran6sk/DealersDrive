import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type * as ReactNative from 'react-native';
import { useState } from 'react';
import CustomerTabs from '../app/(tabs)/_layout';
import { locationStore } from '../src/features/location/location';
import { useDirectoryLocation } from '../src/features/location/use-directory-location';

let mockFocused = true;
const mockRouter = { setParams: jest.fn() };
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(undefined)),
}));
jest.mock('expo-router', () => {
  const { Text, View } = jest.requireActual<typeof ReactNative>('react-native');
  return {
    useRouter: () => mockRouter,
    useIsFocused: () => mockFocused,
    Tabs: Object.assign(({ children }: { children: React.ReactNode }) => <View>{children}</View>, {
      Screen: ({ options }: { options: { title?: string; href?: null } }) =>
        options.href === null ? null : <Text>{options.title}</Text>,
    }),
  };
});
function Probe({ district }: { district?: string }) {
  const ready = useDirectoryLocation(district);
  return <Text>{ready ? 'ready' : 'loading'}</Text>;
}
beforeEach(() => {
  locationStore.setState({ district: undefined, revision: 0, hydrated: true });
  mockFocused = true;
  jest.clearAllMocks();
});
it('renders exactly the five customer tab labels and hides legacy Explore', async () => {
  await render(<CustomerTabs />);
  for (const label of ['Home', 'Cars', 'Dealers', 'Saved', 'Profile'])
    expect(screen.getByText(label)).toBeOnTheScreen();
  expect(screen.queryByText('Explore')).toBeNull();
});
it('seeds a directory from the shared district and resets dependent towns when it changes', async () => {
  locationStore.choose('vellore');
  const view = await render(<Probe />);
  expect(mockRouter.setParams).toHaveBeenCalledWith({ district: 'vellore' });
  await act(() => locationStore.choose('ranipet'));
  await view.rerender(<Probe district="vellore" />);
  await waitFor(() =>
    expect(mockRouter.setParams).toHaveBeenCalledWith({
      district: 'ranipet',
      city: undefined,
      dealer: undefined,
      page: undefined,
    }),
  );
});
it('accepts explicit deep-link districts and updates inactive tabs only on focus', async () => {
  const view = await render(<Probe district="ranipet" />);
  expect(locationStore.getState().district).toBe('ranipet');
  mockRouter.setParams.mockClear();
  mockFocused = false;
  await act(() => locationStore.choose('vellore'));
  await view.rerender(<Probe district="ranipet" />);
  expect(mockRouter.setParams).not.toHaveBeenCalled();
  mockFocused = true;
  await view.rerender(<Probe district="ranipet" />);
  expect(mockRouter.setParams).toHaveBeenCalledWith(
    expect.objectContaining({ district: 'vellore', city: undefined }),
  );
});
it('keeps local form state during unchanged same-owner directory renders', async () => {
  function Draft() {
    useDirectoryLocation(undefined);
    const [text, setText] = useState('');
    return (
      <Text accessibilityRole="button" onPress={() => setText('draft')}>
        {text || 'edit'}
      </Text>
    );
  }
  const view = await render(<Draft />);
  await fireEvent.press(screen.getByText('edit'));
  await view.rerender(<Draft />);
  expect(screen.getByText('draft')).toBeOnTheScreen();
});
it('falls back from an invalid district link instead of waiting on it forever', async () => {
  await render(<Probe district="Not A Slug" />);
  expect(await screen.findByText('ready')).toBeOnTheScreen();
  expect(mockRouter.setParams).toHaveBeenCalledWith({ district: undefined });
});
it('restores the saved district over an invalid district link', async () => {
  locationStore.setState({ district: 'vellore', revision: 5, hydrated: true });
  await render(<Probe district="Not A Slug" />);
  expect(mockRouter.setParams).toHaveBeenCalledWith({ district: 'vellore' });
});
