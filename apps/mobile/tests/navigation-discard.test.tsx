import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { usePreventRemove } from 'expo-router/build/react-navigation/core/usePreventRemove';
import { useDiscardChanges } from '../src/features/navigation/use-discard-changes';
import { NavigationBack } from '../src/components/navigation-back';

const mockDispatch = jest.fn();
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  useRouter: () => mockRouter,
}));
const prevent = jest.mocked(usePreventRemove);
function Form({
  dirty = false,
  busy = false,
  complete = false,
}: {
  dirty?: boolean;
  busy?: boolean;
  complete?: boolean;
}) {
  useDiscardChanges(dirty, busy, () => complete);
  return null;
}
beforeEach(() => jest.clearAllMocks());
it('protects unsent changes on native removal and dispatches only an explicit discard', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await render(<Form dirty />);
  const callback = prevent.mock.calls.at(-1)?.[1];
  expect(prevent).toHaveBeenLastCalledWith(true, expect.any(Function));
  callback?.({ data: { action: { type: 'GO_BACK' } } });
  expect(mockDispatch).not.toHaveBeenCalled();
  const buttons = alert.mock.calls.at(-1)?.[2];
  expect(buttons?.[0]).toMatchObject({ text: 'Keep editing', style: 'cancel' });
  buttons?.[1]?.onPress?.();
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  alert.mockRestore();
});
it('blocks removal during submission, permits completed replacement and ignores clean forms', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const view = await render(<Form busy />);
  prevent.mock.calls.at(-1)?.[1]({ data: { action: { type: 'GO_BACK' } } });
  expect(alert).toHaveBeenCalledWith('Sending your request', expect.any(String));
  expect(mockDispatch).not.toHaveBeenCalled();
  await view.rerender(<Form busy complete />);
  prevent.mock.calls.at(-1)?.[1]({ data: { action: { type: 'REPLACE' } } });
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'REPLACE' });
  await view.rerender(<Form />);
  expect(prevent).toHaveBeenLastCalledWith(false, expect.any(Function));
  alert.mockRestore();
});
it('uses the native back control and a close control for modals', async () => {
  const view = await render(<NavigationBack />);
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  await view.rerender(<NavigationBack close />);
  expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();
});
