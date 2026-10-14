import { fireEvent, render, screen } from '@testing-library/react-native';

import { ActionButton } from '../src/components/action-button';
import { Page } from '../src/components/page';

describe('native foundation components', () => {
  it('exposes scalable headings and explanatory content', async () => {
    await render(<Page title="Saved cars" description="Cars you have saved, on any device." />);
    expect(screen.getByRole('header', { name: 'Saved cars' })).toBeOnTheScreen();
    expect(screen.getByText('Cars you have saved, on any device.')).toBeOnTheScreen();
  });

  it('runs enabled actions and exposes pending state without repeated submissions', async () => {
    const onPress = jest.fn();
    const view = await render(<ActionButton label="Explore" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Explore' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    await view.rerender(<ActionButton label="Explore" onPress={onPress} pending />);
    const pending = screen.getByRole('button', { name: 'Explore' });
    expect(pending).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Explore', busy: true, disabled: true }),
    ).toBeOnTheScreen();
    await fireEvent.press(pending);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
