import type * as ReactNativeModule from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { VehicleCardDto } from '@dealers-drive/contracts/public';
import { CarCard } from '../src/components/car-card';
import { PhotoGallery } from '../src/components/photo-gallery';
import { colors } from '../src/theme/tokens';
import { SAVED_TEXT } from '../src/features/saved/saved.constants';
import { CARS_TEXT } from '../src/features/cars/cars.constants';

const car: VehicleCardDto = {
  slug: 'hyundai-creta',
  availability: 'AVAILABLE',
  title: '2023 Hyundai Creta',
  year: 2023,
  priceLabel: '₹14,50,000',
  metaLabel: 'Petrol · Automatic · 22,400 km',
  image: null,
  imageCount: 0,
  dealer: { name: 'Sri Motors', slug: 'sri-motors', initials: 'SM', isVerified: true },
};
it('matches car identity/price/photo fallback and dealer verification without inventing contact data', async () => {
  const open = jest.fn();
  const dealer = jest.fn();
  await render(<CarCard car={car} onOpen={open} onDealer={dealer} />);
  expect(screen.getByText('Hyundai Creta')).toBeOnTheScreen();
  expect(screen.getByText('₹14,50,000')).toBeOnTheScreen();
  expect(screen.getByText(CARS_TEXT.noPhoto)).toBeOnTheScreen();
  expect(screen.getByText(CARS_TEXT.verified)).toBeOnTheScreen();
  await fireEvent.press(
    screen.getByRole('button', {
      name: CARS_TEXT.openCar(car.title, car.priceLabel ?? undefined, car.metaLabel),
    }),
  );
  expect(open).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    screen.getByRole('button', { name: CARS_TEXT.openDealer(car.dealer.name) }),
  );
  expect(dealer).toHaveBeenCalledTimes(1);
});
it('disables reserved car navigation while keeping the dealership reachable', async () => {
  const open = jest.fn();
  const dealer = jest.fn();
  await render(
    <CarCard car={{ ...car, availability: 'RESERVED' }} onOpen={open} onDealer={dealer} />,
  );
  const reserved = screen.getByRole('button', {
    name: CARS_TEXT.openCar(car.title, car.priceLabel ?? undefined, car.metaLabel, true),
  });
  expect(reserved).toBeDisabled();
  await fireEvent.press(reserved);
  expect(open).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: CARS_TEXT.openDealer(car.dealer.name) }),
  );
  expect(dealer).toHaveBeenCalledTimes(1);
});
it('handles empty galleries and clamps primary indexes before paging', async () => {
  const view = await render(<PhotoGallery images={[]} title={car.title} />);
  expect(screen.getByText(CARS_TEXT.noPhoto)).toBeOnTheScreen();
  await view.rerender(
    <PhotoGallery
      images={[
        { url: 'https://example.test/one.webp', alt: 'Front view' },
        { url: 'https://example.test/two.webp', alt: 'Rear view' },
      ]}
      primaryIndex={99}
      title={car.title}
    />,
  );
  expect(screen.getByText(CARS_TEXT.photos(1, 2))).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: CARS_TEXT.next })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: CARS_TEXT.previous }));
  expect(screen.getByText(CARS_TEXT.photos(0, 2))).toBeOnTheScreen();
});

const mockSaved = {
  isSaved: () => false,
  isPending: () => false,
  ready: true,
  toggle: jest.fn(),
  error: null,
  retry: jest.fn(),
};
jest.mock('../src/features/saved/saved-provider', () => ({ useSaved: () => mockSaved }));

it('uses black outlined/solid hearts without navigating the car on Save', async () => {
  const open = jest.fn();
  const view = await render(<CarCard car={car} onOpen={open} />);
  expect(screen.getByTestId('icon-heart')).toHaveProp('fill', 'none');
  expect(screen.getByTestId('icon-heart')).toHaveProp('stroke', colors.ink);
  await fireEvent.press(screen.getByRole('button', { name: `Save ${car.title}` }));
  expect(mockSaved.toggle).toHaveBeenCalledWith(car.slug);
  expect(open).not.toHaveBeenCalled();
  mockSaved.isSaved = () => true;
  await view.rerender(<CarCard car={car} onOpen={open} />);
  expect(screen.getByTestId('icon-heart')).toHaveProp('fill', colors.ink);
  expect(screen.getByRole('button', { name: SAVED_TEXT.removeLabel(car.title) })).toBeOnTheScreen();
  mockSaved.isSaved = () => false;
});
it('recovers a failed image when a recycled card receives another URI', async () => {
  const view = await render(
    <CarCard
      car={{ ...car, image: { url: 'https://example.test/one.webp', alt: 'First photo' } }}
      onOpen={jest.fn()}
    />,
  );
  await fireEvent(screen.getByLabelText('First photo'), 'error', {
    nativeEvent: { error: 'Image unavailable' },
  });
  expect(screen.getByText(CARS_TEXT.imageFailed)).toBeOnTheScreen();
  await view.rerender(
    <CarCard
      car={{ ...car, image: { url: 'https://example.test/two.webp', alt: 'Second photo' } }}
      onOpen={jest.fn()}
    />,
  );
  expect(screen.getByLabelText('Second photo')).toBeOnTheScreen();
  expect(screen.queryByText(CARS_TEXT.imageFailed)).not.toBeOnTheScreen();
});
it.each(['AVAILABLE', 'RESERVED', 'SOLD', 'UNAVAILABLE'] as const)(
  'renders the shared %s card variant with real fallback data',
  async (availability) => {
    const view = await render(
      <CarCard
        car={{
          ...car,
          availability,
          priceLabel: null,
          year: null,
          image: null,
          dealer: { ...car.dealer, isVerified: false },
        }}
        onOpen={jest.fn()}
      />,
    );
    expect(screen.getByText(CARS_TEXT.priceRequest)).toBeOnTheScreen();
    expect(screen.queryByText(CARS_TEXT.verified)).not.toBeOnTheScreen();
    expect(view.toJSON()).toMatchSnapshot();
  },
);

jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual<typeof ReactNativeModule>('react-native');
  return { __esModule: true, default: View, Path: View, SvgXml: View };
});
