import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { PublicVehicleImage } from '@dealers-drive/contracts/public';
import { PhotoGallery } from '../src/components/photo-gallery';
import { MAX_GALLERY_DOTS } from '../src/components/photo-gallery/photo-gallery.constants';
import { CARS_TEXT } from '../src/features/cars/cars.constants';

const photos = (count: number): PublicVehicleImage[] =>
  Array.from({ length: count }, (_unused, index) => ({
    url: `https://example.test/${index}.webp`,
    alt: `Photo alt ${index}`,
  }));
const hidden = { includeHiddenElements: true };
const region = () => screen.getByTestId('photo-gallery-region');
const act11y = (actionName: string) =>
  act(async () => {
    await fireEvent(region(), 'accessibilityAction', { nativeEvent: { actionName } });
  });

it('shows the placeholder and no swipe region when there are no photos', async () => {
  await render(<PhotoGallery images={[]} title="Creta" />);
  expect(screen.getByText(CARS_TEXT.noPhoto)).toBeOnTheScreen();
  expect(screen.queryByTestId('photo-gallery-region')).toBeNull();
});
it('shows one photo without an indicator, counter or paging actions', async () => {
  await render(<PhotoGallery images={photos(1)} title="Creta" />);
  expect(screen.queryByTestId('gallery-indicator')).toBeNull();
  expect(region()).toHaveProp('accessibilityActions', [
    { name: 'activate', label: CARS_TEXT.openViewer },
  ]);
  expect(screen.getByTestId('photo-gallery-list')).toHaveProp('scrollEnabled', false);
});
it('swipes between photos with dots and a counter, and no visible Previous/Next buttons', async () => {
  await render(<PhotoGallery images={photos(3)} title="Creta" />);
  expect(screen.queryByRole('button', { name: CARS_TEXT.next })).toBeNull();
  expect(screen.queryByRole('button', { name: CARS_TEXT.previous })).toBeNull();
  expect(screen.getByText(CARS_TEXT.photoCounter(0, 3), hidden)).toBeOnTheScreen();
  expect(screen.getAllByTestId(/gallery-dot/, hidden)).toHaveLength(3);
  expect(screen.getByTestId('photo-gallery-list')).toHaveProp('pagingEnabled', true);
  await act(async () => {
    await fireEvent(screen.getByTestId('photo-gallery-region'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 225 } },
    });
  });
  await act(async () => {
    await fireEvent(screen.getByTestId('photo-gallery-list'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 600, y: 0 } },
    });
  });
  expect(screen.getByText(CARS_TEXT.photoCounter(2, 3), hidden)).toBeOnTheScreen();
  expect(region()).toHaveAccessibilityValue({ text: CARS_TEXT.photos(2, 3) });
});
it('gives TalkBack users increment, decrement and open actions instead of buttons', async () => {
  await render(<PhotoGallery images={photos(3)} title="Creta" />);
  expect(region()).toHaveProp('accessibilityRole', 'adjustable');
  await act11y('increment');
  expect(region()).toHaveAccessibilityValue({ text: CARS_TEXT.photos(1, 3) });
  await act11y('increment');
  await act11y('increment');
  expect(region()).toHaveAccessibilityValue({ text: CARS_TEXT.photos(2, 3) });
  await act11y('decrement');
  expect(region()).toHaveAccessibilityValue({ text: CARS_TEXT.photos(1, 3) });
  await act11y('activate');
  expect(screen.getByTestId('photo-viewer-region')).toBeOnTheScreen();
});
it('opens the full-screen viewer at the tapped photo and closes it on system Back', async () => {
  await render(<PhotoGallery images={photos(3)} primaryIndex={1} title="Creta" />);
  await fireEvent.press(screen.getByLabelText('Photo alt 1'));
  const viewer = screen.getByTestId('photo-viewer-region');
  expect(viewer).toHaveAccessibilityValue({ text: CARS_TEXT.photos(1, 3) });
  expect(within(viewer).queryByText(CARS_TEXT.next)).toBeNull();
  expect(screen.queryByText(CARS_TEXT.previous)).toBeNull();
  await act(async () => {
    await fireEvent(viewer, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
  });
  expect(screen.getByTestId('photo-viewer-region')).toHaveAccessibilityValue({
    text: CARS_TEXT.photos(2, 3),
  });
  await act(async () => {
    await fireEvent(screen.getByTestId('photo-viewer', hidden), 'requestClose');
  });
  expect(screen.queryByTestId('photo-viewer-region')).toBeNull();
  expect(region()).toHaveAccessibilityValue({ text: CARS_TEXT.photos(2, 3) });
});
it('keeps the counter but drops dots for long galleries', async () => {
  await render(<PhotoGallery images={photos(MAX_GALLERY_DOTS + 3)} title="Creta" />);
  expect(screen.queryAllByTestId(/gallery-dot/, hidden)).toHaveLength(0);
  expect(
    screen.getByText(CARS_TEXT.photoCounter(0, MAX_GALLERY_DOTS + 3), hidden),
  ).toBeOnTheScreen();
});
