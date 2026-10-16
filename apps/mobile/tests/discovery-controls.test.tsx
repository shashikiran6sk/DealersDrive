import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  NO_VEHICLE_FACETS,
  VEHICLE_SORT_LABELS,
  VehicleSort,
} from '@dealers-drive/contracts/public';
import { DiscoveryTools } from '../src/components/discovery-tools';
import { AppliedFilters } from '../src/features/cars/applied-filters';
import { SortDialog } from '../src/features/cars/sort-dialog';
import { TownPills } from '../src/components/town-pills';

it('opens separate Sort and Filters actions', async () => {
  const sort = jest.fn();
  const filters = jest.fn();
  await render(<DiscoveryTools count={2} onSort={sort} onFilters={filters} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sort' }));
  expect(sort).toHaveBeenCalledTimes(1);
  expect(filters).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Filters, 2 active' }));
  expect(filters).toHaveBeenCalledTimes(1);
});
it('uses only supported radio sort choices and closes after selection', async () => {
  const select = jest.fn();
  const close = jest.fn();
  await render(<SortDialog value="newest" onSelect={select} onClose={close} />);
  expect(screen.getAllByRole('radio')).toHaveLength(VehicleSort.options.length);
  expect(
    screen.getByRole('radio', { name: VEHICLE_SORT_LABELS.newest, checked: true }),
  ).toBeOnTheScreen();
  const next = VehicleSort.options.find((option) => option !== 'newest');
  if (!next) throw new Error('Missing sort fixture');
  await fireEvent.press(screen.getByRole('radio', { name: VEHICLE_SORT_LABELS[next] }));
  expect(select).toHaveBeenCalledWith(next);
  expect(close).toHaveBeenCalledTimes(1);
});
it('removes one selected town without dropping other filters or retaining a stale page', async () => {
  const change = jest.fn();
  await render(
    <AppliedFilters
      params={{ district: 'vellore', city: 'katpadi,vellore', fuel: 'petrol', page: '3' }}
      facets={{
        ...NO_VEHICLE_FACETS,
        cities: [
          { value: 'katpadi', label: 'Katpadi', count: 2 },
          { value: 'vellore', label: 'Vellore', count: 1 },
        ],
      }}
      onChange={change}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Remove Katpadi filter' }));
  expect(change).toHaveBeenCalledWith({ district: 'vellore', city: 'vellore', fuel: 'petrol' });
});
it('shows multi-town selected states and allows removing a zero-count selected town', async () => {
  const toggle = jest.fn();
  const clear = jest.fn();
  await render(
    <TownPills
      options={[
        { value: 'katpadi', label: 'Katpadi', count: 0 },
        { value: 'vellore', label: 'Vellore', count: 1 },
      ]}
      selected={['katpadi', 'vellore']}
      onToggle={toggle}
      onClear={clear}
    />,
  );
  await fireEvent.press(
    screen.getByRole('checkbox', { name: 'Katpadi, 0 dealerships', checked: true }),
  );
  expect(toggle).toHaveBeenCalledWith('katpadi');
  await fireEvent.press(screen.getByRole('button', { name: 'All towns' }));
  expect(clear).toHaveBeenCalledTimes(1);
});
