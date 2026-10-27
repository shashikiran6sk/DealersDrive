import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { type GalleryPhoto, PhotoGallery } from '@/components/ui/photo-gallery';
import {
  UNZOOMED,
  arrowPan,
  clampScale,
  clampView,
  hasModifier,
  isDoubleTap,
  isTap,
  isZoomed,
  panView,
  pinchView,
  settleView,
  stepView,
  toggleView,
  wheelScale,
  zoomAt,
  zoomKey,
  zoomTransform,
} from '@/components/ui/photo-gallery/utils';

const TITLE = '2021 Toyota Fortuner 2.8 4x2 AT';
const FRAME = { left: 0, top: 0, width: 800, height: 600 };

function images(count: number): GalleryPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://media.test/by-media/m${index}/1024.webp`,
    alt: `${TITLE}, photograph ${index + 1} of ${count}`,
  }));
}

async function openViewer(count = 4) {
  const user = userEvent.setup();
  render(<PhotoGallery title={TITLE} photos={images(count)} />);
  await user.click(screen.getByRole('button', { name: /^View all|^View the photo/ }));
  const dialog = await screen.findByRole('dialog', { name: TITLE });
  return { user, dialog };
}

function photo(dialog: HTMLElement): HTMLElement {
  return within(dialog).getByRole('img', { name: /photograph \d of \d/ });
}

function frameOf(dialog: HTMLElement): HTMLElement {
  const frame = photo(dialog).parentElement;
  if (!frame) throw new Error('no frame');
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: FRAME.left, y: FRAME.top, width: FRAME.width, height: FRAME.height }),
  );
  return frame;
}

function transform(dialog: HTMLElement): string {
  return photo(dialog).style.transform;
}

function tap(target: Element, x: number, y: number, pointerId = 1) {
  fireEvent.pointerDown(target, { pointerId, pointerType: 'touch', clientX: x, clientY: y });
  fireEvent.pointerUp(target, { pointerId, pointerType: 'touch', clientX: x, clientY: y });
}

describe('zooming in the fullscreen viewer', () => {
  it('starts unzoomed, with Zoom out disabled and Zoom in ready', async () => {
    const { dialog } = await openViewer();
    const controls = within(dialog).getByRole('group', { name: 'Zoom' });

    expect(within(controls).getByRole('button', { name: 'Zoom out' })).toBeDisabled();
    expect(within(controls).getByRole('button', { name: 'Zoom in' })).toBeEnabled();
    expect(transform(dialog)).toBe(zoomTransform(UNZOOMED));
    expect(photo(dialog).parentElement).toHaveClass(
      'touch-none',
      'overflow-hidden',
      'cursor-zoom-in',
    );
  });

  it('zooms in and out with its buttons, about the centre, and stops at both ends', async () => {
    const { user, dialog } = await openViewer();
    frameOf(dialog);
    const zoomIn = within(dialog).getByRole('button', { name: 'Zoom in' });
    const zoomOut = within(dialog).getByRole('button', { name: 'Zoom out' });

    await user.click(zoomIn);
    expect(transform(dialog)).toBe('translate3d(0px, 0px, 0) scale(1.5)');
    expect(zoomOut).toBeEnabled();
    expect(photo(dialog).parentElement).toHaveClass('cursor-grab');

    await user.click(zoomIn);
    await user.click(zoomIn);
    await user.click(zoomIn);
    expect(transform(dialog)).toBe('translate3d(0px, 0px, 0) scale(4)');
    expect(zoomIn).toBeDisabled();

    for (let press = 0; press < 4; press += 1) await user.click(zoomOut);
    expect(transform(dialog)).toBe(zoomTransform(UNZOOMED));
    expect(zoomOut).toBeDisabled();
  });

  it('zooms with + and -, resets with 0, and leaves the browser its own Ctrl + zoom', async () => {
    const { user, dialog } = await openViewer();
    frameOf(dialog);

    await user.keyboard('+');
    expect(transform(dialog)).toContain('scale(1.5)');
    await user.keyboard('=');
    expect(transform(dialog)).toContain('scale(2.25)');
    await user.keyboard('-');
    expect(transform(dialog)).toContain('scale(1.5)');
    await user.keyboard('0');
    expect(transform(dialog)).toBe(zoomTransform(UNZOOMED));

    await user.keyboard('{Control>}+{/Control}');
    expect(transform(dialog)).toBe(zoomTransform(UNZOOMED));
  });

  it('pans with the arrow keys while zoomed instead of paging, and pages again at 1x', async () => {
    const { user, dialog } = await openViewer();
    frameOf(dialog);

    await user.keyboard('+');
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByText('1 / 4')).toBeInTheDocument();
    expect(transform(dialog)).toBe('translate3d(-80px, 0px, 0) scale(1.5)');
    await user.keyboard('{ArrowDown}');
    expect(transform(dialog)).toBe('translate3d(-80px, -80px, 0) scale(1.5)');

    await user.keyboard('0');
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByText('2 / 4')).toBeInTheDocument();
  });

  it('zooms toward the cursor on the wheel, and keeps the wheel from scrolling anything', async () => {
    const { dialog } = await openViewer();
    const frame = frameOf(dialog);

    const scrolled = fireEvent.wheel(frame, { deltaY: -200, clientX: 600, clientY: 300 });
    expect(scrolled).toBe(false);
    const zoomedIn = transform(dialog);
    expect(zoomedIn).toMatch(/^translate3d\(-\d+(\.\d+)?px, 0px, 0\) scale\(1\.49\d*\)$/);

    fireEvent.wheel(frame, { deltaY: 2000, clientX: 600, clientY: 300 });
    expect(transform(dialog)).toBe(zoomTransform(UNZOOMED));
  });

  it('toggles 2.5x on a double tap, centred on the tap, and back on another', async () => {
    const { dialog } = await openViewer();
    const frame = frameOf(dialog);

    tap(frame, 500, 300);
    expect(transform(dialog)).toBe(zoomTransform(UNZOOMED));
    tap(frame, 502, 300);
    expect(transform(dialog)).toBe('translate3d(-153px, 0px, 0) scale(2.5)');
    expect(within(dialog).getByText('1 / 4')).toBeInTheDocument();

    tap(frame, 400, 300);
    tap(frame, 400, 300);
    expect(transform(dialog)).toBe(zoomTransform(UNZOOMED));
  });

  it('zooms on a pinch, and the pinch never pages', async () => {
    const { dialog } = await openViewer();
    const frame = frameOf(dialog);

    fireEvent.pointerDown(frame, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 350,
      clientY: 300,
    });
    fireEvent.pointerDown(frame, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 450,
      clientY: 300,
    });
    fireEvent.pointerMove(frame, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 300,
      clientY: 300,
    });
    fireEvent.pointerMove(frame, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 500,
      clientY: 300,
    });
    fireEvent.pointerUp(frame, { pointerId: 2, pointerType: 'touch', clientX: 500, clientY: 300 });
    fireEvent.pointerUp(frame, { pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 300 });

    expect(transform(dialog)).toBe('translate3d(0px, 0px, 0) scale(2)');
    expect(within(dialog).getByText('1 / 4')).toBeInTheDocument();
  });

  it('drags the zoomed photograph instead of swiping, within its edges', async () => {
    const { user, dialog } = await openViewer();
    const frame = frameOf(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Zoom in' }));

    fireEvent.pointerDown(frame, {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 400,
      clientY: 300,
    });
    fireEvent.pointerMove(frame, {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 300,
      clientY: 280,
    });
    fireEvent.pointerMove(frame, {
      pointerId: 3,
      pointerType: 'touch',
      clientX: -400,
      clientY: 280,
    });
    fireEvent.pointerUp(frame, { pointerId: 3, pointerType: 'touch', clientX: -400, clientY: 280 });

    expect(transform(dialog)).toBe('translate3d(-200px, -20px, 0) scale(1.5)');
    expect(within(dialog).getByText('1 / 4')).toBeInTheDocument();
  });

  it('drags with the mouse too, and leaves the browser no image to drag away', async () => {
    const { user, dialog } = await openViewer();
    const frame = frameOf(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Zoom in' }));

    expect(photo(dialog)).toHaveAttribute('draggable', 'false');
    const pressed = fireEvent.pointerDown(frame, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 400,
      clientY: 300,
    });
    expect(pressed).toBe(false);
    fireEvent.pointerMove(frame, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 450,
      clientY: 300,
    });
    fireEvent.pointerUp(frame, { pointerId: 1, pointerType: 'mouse', clientX: 450, clientY: 300 });
    expect(transform(dialog)).toBe('translate3d(50px, 0px, 0) scale(1.5)');
  });

  it('still swipes between photographs at 1x', async () => {
    const { dialog } = await openViewer();
    const frame = frameOf(dialog);

    fireEvent.pointerDown(frame, {
      pointerId: 7,
      pointerType: 'touch',
      clientX: 400,
      clientY: 200,
    });
    fireEvent.pointerUp(frame, { pointerId: 7, pointerType: 'touch', clientX: 300, clientY: 200 });
    expect(within(dialog).getByText('2 / 4')).toBeInTheDocument();
    expect(transform(dialog)).toBe(zoomTransform(UNZOOMED));
  });

  it('starts every photograph, and every opening, unzoomed', async () => {
    const { user, dialog } = await openViewer();
    frameOf(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Zoom in' }));
    await user.click(within(dialog).getByRole('button', { name: 'Next photo' }));
    expect(within(dialog).getByText('2 / 4')).toBeInTheDocument();
    expect(transform(dialog)).toBe(zoomTransform(UNZOOMED));

    frameOf(dialog);
    await user.keyboard('+');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^View all/ }));
    const reopened = await screen.findByRole('dialog', { name: TITLE });
    expect(transform(reopened)).toBe(zoomTransform(UNZOOMED));
  });

  it('zooms a single photograph too, which has no pages to turn', async () => {
    const { user, dialog } = await openViewer(1);
    frameOf(dialog);

    await user.keyboard('+');
    expect(transform(dialog)).toContain('scale(1.5)');
  });
});

describe('pinching the photograph on the page', () => {
  it('lets the browser pinch-zoom the page over the photograph, and still scroll it', () => {
    render(<PhotoGallery title={TITLE} photos={images(3)} />);
    const hero = screen.getByRole('button', { name: /^View all/ });
    expect(hero.parentElement).toHaveClass('touch-pan-y', 'touch-pinch-zoom');
  });

  it('reads a second finger as a pinch, never as a swipe', () => {
    render(<PhotoGallery title={TITLE} photos={images(3)} />);
    const hero = screen.getByRole('button', { name: /^View all/ });
    const image = within(hero).getByRole('img');

    fireEvent.pointerDown(image, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 300,
      clientY: 200,
    });
    fireEvent.pointerDown(image, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 340,
      clientY: 200,
    });
    fireEvent.pointerUp(image, { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 200 });
    fireEvent.pointerUp(image, { pointerId: 2, pointerType: 'touch', clientX: 400, clientY: 200 });

    expect(image).toHaveAttribute('src', 'https://media.test/by-media/m0/1024.webp');
  });
});

describe('the zoom helpers', () => {
  it('keeps the scale between 1x and 4x', () => {
    expect(clampScale(0.5)).toBe(1);
    expect(clampScale(2)).toBe(2);
    expect(clampScale(9)).toBe(4);
  });

  it('keeps the point under the cursor still while zooming', () => {
    const view = zoomAt(UNZOOMED, 2, { x: 100, y: 50 }, FRAME);
    expect(view).toEqual({ scale: 2, x: -100, y: -50 });
    expect((100 - view.x) / view.scale).toBe(100);
  });

  it('never pans the photograph past its own edges', () => {
    expect(clampView({ scale: 2, x: 1000, y: -1000 }, FRAME)).toEqual({
      scale: 2,
      x: 400,
      y: -300,
    });
    expect(panView({ scale: 1.5, x: 0, y: 0 }, { x: -50, y: 10 }, FRAME)).toEqual({
      scale: 1.5,
      x: -50,
      y: 10,
    });
  });

  it('snaps to exactly unzoomed at 1x, so nothing re-renders for a pan it cannot make', () => {
    expect(clampView({ scale: 0.8, x: 30, y: 30 }, FRAME)).toBe(UNZOOMED);
    expect(panView(UNZOOMED, { x: 40, y: 0 }, FRAME)).toBe(UNZOOMED);
    expect(isZoomed(UNZOOMED)).toBe(false);
    expect(isZoomed({ scale: 1.01, x: 0, y: 0 })).toBe(true);
  });

  it('settles a barely-zoomed photograph back to 1x when the fingers lift', () => {
    expect(settleView({ scale: 1.03, x: 4, y: 0 })).toBe(UNZOOMED);
    const zoomed = { scale: 1.2, x: 4, y: 0 };
    expect(settleView(zoomed)).toBe(zoomed);
  });

  it('steps by 1.5x about the centre, and resets', () => {
    expect(stepView(UNZOOMED, 'in', FRAME)).toEqual({ scale: 1.5, x: 0, y: 0 });
    expect(stepView({ scale: 1.5, x: 90, y: 0 }, 'out', FRAME)).toBe(UNZOOMED);
    expect(stepView({ scale: 3, x: 90, y: 0 }, 'reset', FRAME)).toBe(UNZOOMED);
  });

  it('toggles between 1x and 2.5x', () => {
    expect(toggleView(UNZOOMED, { x: 0, y: 0 }, FRAME)).toEqual({ scale: 2.5, x: 0, y: 0 });
    expect(toggleView({ scale: 1.2, x: 0, y: 0 }, { x: 0, y: 0 }, FRAME)).toBe(UNZOOMED);
  });

  it('scales with the spread of two fingers, and follows their midpoint', () => {
    const before = [
      { x: 350, y: 300 },
      { x: 450, y: 300 },
    ] as const;
    const after = [
      { x: 310, y: 320 },
      { x: 510, y: 320 },
    ] as const;
    expect(pinchView(UNZOOMED, before, after, FRAME)).toEqual({ scale: 2, x: 10, y: 20 });
    expect(pinchView(UNZOOMED, [before[0], before[0]], after, FRAME)).toBe(UNZOOMED);
  });

  it('zooms in on a wheel up, out on a wheel down, and treats lines and trackpad pinches alike', () => {
    expect(wheelScale(1, { deltaY: -100, deltaMode: 0, ctrlKey: false })).toBeCloseTo(1.2214, 4);
    expect(wheelScale(2, { deltaY: 100, deltaMode: 0, ctrlKey: false })).toBeCloseTo(1.6375, 4);
    expect(wheelScale(1, { deltaY: -3, deltaMode: 1, ctrlKey: false })).toBeCloseTo(
      wheelScale(1, { deltaY: -48, deltaMode: 0, ctrlKey: false }),
      10,
    );
    expect(wheelScale(1, { deltaY: -10, deltaMode: 0, ctrlKey: true })).toBeCloseTo(1.1052, 4);
  });

  it('reads + and = as in, - and _ as out, and 0 as reset', () => {
    expect(zoomKey('+')).toBe('in');
    expect(zoomKey('=')).toBe('in');
    expect(zoomKey('-')).toBe('out');
    expect(zoomKey('_')).toBe('out');
    expect(zoomKey('0')).toBe('reset');
    expect(zoomKey('ArrowLeft')).toBeNull();
  });

  it('pans toward the side an arrow key points at', () => {
    expect(arrowPan('ArrowLeft')).toEqual({ x: 80, y: 0 });
    expect(arrowPan('ArrowRight')).toEqual({ x: -80, y: 0 });
    expect(arrowPan('ArrowUp')).toEqual({ x: 0, y: 80 });
    expect(arrowPan('ArrowDown')).toEqual({ x: 0, y: -80 });
    expect(arrowPan('Enter')).toBeNull();
  });

  it('knows a tap from a drag, and a double tap from two taps', () => {
    expect(isTap({ time: 0, x: 0, y: 0 }, { time: 200, x: 6, y: 6 })).toBe(true);
    expect(isTap({ time: 0, x: 0, y: 0 }, { time: 200, x: 20, y: 0 })).toBe(false);
    expect(isTap({ time: 0, x: 0, y: 0 }, { time: 400, x: 0, y: 0 })).toBe(false);
    expect(isDoubleTap({ time: 0, x: 0, y: 0 }, { time: 250, x: 20, y: 0 })).toBe(true);
    expect(isDoubleTap({ time: 0, x: 0, y: 0 }, { time: 350, x: 0, y: 0 })).toBe(false);
    expect(isDoubleTap({ time: 0, x: 0, y: 0 }, { time: 100, x: 60, y: 0 })).toBe(false);
  });

  it('leaves modified keys to the browser', () => {
    expect(hasModifier({ ctrlKey: true, metaKey: false, altKey: false })).toBe(true);
    expect(hasModifier({ ctrlKey: false, metaKey: true, altKey: false })).toBe(true);
    expect(hasModifier({ ctrlKey: false, metaKey: false, altKey: false })).toBe(false);
  });
});
