import { render, screen, fireEvent } from '@testing-library/react-native';
import { AppErrorBoundary } from '../src/features/reliability/app-error-boundary';
import { RELIABILITY_TEXT } from '../src/features/reliability/reliability.constants';

test('shows a safe recovery message without disclosing the thrown error or credentials', async () => {
  const retry = jest.fn(() => Promise.resolve());
  await render(
    <AppErrorBoundary error={new Error('Authorization: private-token OTP 123456')} retry={retry} />,
  );
  expect(screen.getByRole('header', { name: RELIABILITY_TEXT.failed })).toBeOnTheScreen();
  expect(screen.queryByText(/private-token|123456/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: RELIABILITY_TEXT.retry }));
  expect(retry).toHaveBeenCalledTimes(1);
});
