import { fireEvent, render, screen } from '@testing-library/react-native';
import type { VehicleCardDto } from '@dealers-drive/contracts/public';
import { CarCard } from '../src/components/car-card';
import { PhotoGallery } from '../src/components/photo-gallery';
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
