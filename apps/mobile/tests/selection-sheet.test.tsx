import { fireEvent, render, screen } from '@testing-library/react-native';
import { SelectionSheet } from '../src/components/selection-sheet';

it('selects supported radio options and handles native Back without applying a choice', async () => {
  const select = jest.fn();
  const close = jest.fn();
  await render(
    <SelectionSheet
      title="Sort"
      options={[
        { value: 'newest', label: 'Newest first' },
        { value: 'price-asc', label: 'Price low to high' },
      ]}
      value="newest"
      onSelect={select}
      onClose={close}
    />,
  );
  expect(screen.getByRole('radio', { name: 'Newest first', checked: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Price low to high' }));
  expect(select).toHaveBeenCalledWith('price-asc');
  await fireEvent(screen.getByTestId('selection-sheet'), 'requestClose');
  expect(close).toHaveBeenCalledTimes(1);
  expect(select).toHaveBeenCalledTimes(1);
});
it('provides search, loading and recoverable error states without fake options', async () => {
  const props = {
    title: 'Issue',
    options: [{ value: 'ACCOUNT_ISSUE', label: 'My account' }],
    onSelect: jest.fn(),
    onClose: jest.fn(),
  };
  const view = await render(<SelectionSheet {...props} searchable />);
  await fireEvent.changeText(screen.getByLabelText('Search issue'), 'zzz');
  expect(screen.getByText('No matching options')).toBeOnTheScreen();
  await view.rerender(<SelectionSheet {...props} pending />);
  expect(screen.getByLabelText('Loading options')).toBeOnTheScreen();
  expect(screen.queryByRole('radio')).toBeNull();
  const retry = jest.fn();
  await view.rerender(<SelectionSheet {...props} error="Unavailable" retry={retry} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});
