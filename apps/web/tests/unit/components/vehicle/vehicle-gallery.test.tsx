import type { PublicVehicleImage } from '@dealers-drive/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { VehicleGallery } from '@/components/vehicle/vehicle-gallery';
import {
  arrowStep,
  railNumber,
  revealOffset,
  startIndex,
  stripEdges,
  wrapIndex,
} from '@/components/vehicle/vehicle-gallery/utils';

const TITLE = '2021 Toyota Fortuner 2.8 4x2 AT';

function images(count: number): PublicVehicleImage[] {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://media.test/by-media/m${index}/1024.webp`,
    alt: `${TITLE}, photograph ${index + 1} of ${count}`,
  }));
}

function gallery() {
  return within(screen.getByRole('region', { name: 'Photographs' }));
}

async function openViewer(user: ReturnType<typeof userEvent.setup>, name: string | RegExp) {
  await user.click(screen.getByRole('button', { name }));
  return screen.findByRole('dialog', { name: TITLE });
}

describe('the gallery on the page', () => {
  it('shows the primary photograph in a blueprint frame with a view-all tag', () => {
    render(<VehicleGallery title={TITLE} images={images(11)} primaryIndex={1} />);

    const main = gallery().getByRole('button', { name: `View all 11 photos of ${TITLE}` });
    expect(main).toHaveClass('blueprint');
    expect(main.querySelectorAll('.corner')).toHaveLength(4);
    expect(within(main).getByRole('img')).toHaveAttribute(
      'src',
      'https://media.test/by-media/m1/1024.webp',
    );
    expect(within(main).getByText('11 photos · view all')).toBeInTheDocument();
  });

  it('lays every photograph out as a thumbnail in the strip, in order', () => {
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);

    const thumbs = gallery().getAllByRole('button', { name: /^Open photo/ });
    expect(thumbs.map((thumb) => thumb.getAttribute('aria-label'))).toEqual([
      'Open photo 1 of 3',
      'Open photo 2 of 3',
      'Open photo 3 of 3',
    ]);
    expect(thumbs[2]!.querySelector('img')).toHaveAttribute(
      'src',
      'https://media.test/by-media/m2/320.webp',
    );
  });

  it('scrolls the strip 240px with its arrows without opening the viewer', () => {
    render(<VehicleGallery title={TITLE} images={images(12)} primaryIndex={0} />);
    const track = document.querySelector('.dd-strip');
    if (!(track instanceof HTMLElement)) throw new Error('no strip');
    const scrollBy = vi.fn();
    track.scrollBy = scrollBy;
    Object.defineProperty(track, 'scrollWidth', { value: 1200, configurable: true });
    Object.defineProperty(track, 'clientWidth', { value: 500, configurable: true });

    fireEvent.scroll(track);
    const left = gallery().getByRole('button', { name: 'Scroll photos left' });
    const right = gallery().getByRole('button', { name: 'Scroll photos right' });
    expect(left).toBeDisabled();
    expect(right).toBeEnabled();

    fireEvent.click(right);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 240, behavior: 'smooth' });

    track.scrollLeft = 700;
    fireEvent.scroll(track);
    expect(left).toBeEnabled();
    expect(right).toBeDisabled();
    fireEvent.click(left);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -240, behavior: 'smooth' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reaches the image, the strip arrows and every thumbnail by keyboard', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(2)} primaryIndex={0} />);
    const track = document.querySelector('.dd-strip');
    if (!(track instanceof HTMLElement)) throw new Error('no strip');
    Object.defineProperty(track, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true });
    fireEvent.scroll(track);

    await user.tab();
    expect(screen.getByRole('button', { name: /^View all/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Previous image' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next image' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Open photo 1 of 2' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Open photo 2 of 2' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Scroll photos right' })).toHaveFocus();
  });

  it('shows no strip for a single photograph', () => {
    render(<VehicleGallery title={TITLE} images={images(1)} primaryIndex={0} />);
    expect(screen.queryByRole('button', { name: /Scroll photos|Open photo/ })).toBeNull();
    expect(screen.getByText('1 photo · view')).toBeInTheDocument();
  });

  it('holds the frame with a labelled slot when there are none, and survives a bad index', () => {
    const { rerender } = render(<VehicleGallery title={TITLE} images={[]} primaryIndex={0} />);
    expect(screen.getByRole('img', { name: 'Photographs coming soon' })).toBeInTheDocument();

    rerender(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={9} />);
    expect(gallery().getAllByRole('img')[0]).toHaveAttribute(
      'src',
      'https://media.test/by-media/m0/1024.webp',
    );
  });
});

function hero() {
  return gallery().getByRole('button', { name: /^View all|^View the photo/ });
}

function heroSrc(): string | null {
  return within(hero()).getByRole('img').getAttribute('src');
}

function src(index: number): string {
  return `https://media.test/by-media/m${index}/1024.webp`;
}

function selectedThumb(): string | null {
  const current = gallery()
    .getAllByRole('button', { name: /^Open photo/ })
    .filter((thumb) => thumb.getAttribute('aria-current') === 'true');
  expect(current).toHaveLength(1);
  return current[0]?.getAttribute('aria-label') ?? null;
}

describe('the hero arrows — one image state for hero, strip and viewer', () => {
  it('shows Previous image and Next image over the hero when there are several photos', () => {
    render(<VehicleGallery title={TITLE} images={images(5)} primaryIndex={0} />);
    const previous = gallery().getByRole('button', { name: 'Previous image' });
    const next = gallery().getByRole('button', { name: 'Next image' });
    expect(previous.tagName).toBe('BUTTON');
    expect(next).toHaveAttribute('type', 'button');
    expect(previous).toHaveClass('dd-arrow');
    expect(previous).toBeEnabled();
    expect(next).toBeEnabled();
    expect(hero()).not.toContainElement(previous);
    expect(hero().parentElement).toContainElement(next);
  });

  it('shows no arrows over the hero for a single photograph', () => {
    render(<VehicleGallery title={TITLE} images={images(1)} primaryIndex={0} />);
    expect(screen.queryByRole('button', { name: /Previous image|Next image/ })).toBeNull();
    expect(heroSrc()).toBe(src(0));
  });

  it('advances and goes back through the photographs from the hero', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(5)} primaryIndex={2} />);
    expect(heroSrc()).toBe(src(2));

    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(heroSrc()).toBe(src(3));
    expect(within(hero()).getByRole('img')).toHaveAttribute('alt', `${TITLE}, photograph 4 of 5`);
    await user.click(screen.getByRole('button', { name: 'Previous image' }));
    await user.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(heroSrc()).toBe(src(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('wraps at both ends, as the viewer does', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);

    await user.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(heroSrc()).toBe(src(2));
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(heroSrc()).toBe(src(0));
  });

  it('moves the selected thumbnail with the hero', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(4)} primaryIndex={0} />);
    expect(selectedThumb()).toBe('Open photo 1 of 4');

    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(selectedThumb()).toBe('Open photo 2 of 4');
    await user.click(screen.getByRole('button', { name: 'Previous image' }));
    await user.click(screen.getByRole('button', { name: 'Previous image' }));
    expect(selectedThumb()).toBe('Open photo 4 of 4');
  });

  it('can be driven from the keyboard', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(4)} primaryIndex={0} />);
    screen.getByRole('button', { name: 'Next image' }).focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(heroSrc()).toBe(src(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the viewer on the photograph the hero is showing', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(9)} primaryIndex={0} />);
    for (let press = 0; press < 4; press += 1) {
      await user.click(screen.getByRole('button', { name: 'Next image' }));
    }

    const dialog = await openViewer(user, /^View all/);
    expect(within(dialog).getByText('5 / 9')).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: `${TITLE}, photograph 5 of 9` })).toBeVisible();
  });

  it('shows on the hero the photograph a thumbnail opened, once the viewer closes', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(9)} primaryIndex={0} />);

    const dialog = await openViewer(user, 'Open photo 7 of 9');
    expect(within(dialog).getByText('7 / 9')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(heroSrc()).toBe(src(6));
    expect(selectedThumb()).toBe('Open photo 7 of 9');
    const again = await openViewer(user, /^View all/);
    expect(within(again).getByText('7 / 9')).toBeInTheDocument();
  });

  it('keeps the hero where the viewer was left', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(9)} primaryIndex={0} />);
    await user.click(screen.getByRole('button', { name: 'Next image' }));

    const dialog = await openViewer(user, /^View all/);
    expect(within(dialog).getByText('2 / 9')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Next photo' }));
    await user.click(
      within(within(dialog).getByRole('navigation', { name: 'All photos' })).getByRole('button', {
        name: 'Photo 7 of 9',
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(heroSrc()).toBe(src(6));
    expect(selectedThumb()).toBe('Open photo 7 of 9');
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(heroSrc()).toBe(src(7));
  });

  it('scrolls the strip to keep the selected thumbnail in view, and only when it is not', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(12)} primaryIndex={0} />);
    const track = document.querySelector('.dd-strip');
    if (!(track instanceof HTMLElement)) throw new Error('no strip');
    const scrollBy = vi.fn();
    track.scrollBy = scrollBy;
    track.getBoundingClientRect = () => DOMRect.fromRect({ x: 100, width: 400, height: 80 });
    const thumbs = gallery().getAllByRole('button', { name: /^Open photo/ });
    thumbs.forEach((thumb, at) => {
      thumb.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: 100 + at * 116, width: 108, height: 80 });
    });

    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(scrollBy).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(scrollBy).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 56, behavior: 'smooth' });
  });
});

describe('the fullscreen viewer', () => {
  it('opens from the main image on the primary, with the brand, title, counter and Close', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(11)} primaryIndex={1} />);

    const dialog = await openViewer(user, /^View all/);
    expect(within(dialog).getByText('DD')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: TITLE })).toBeInTheDocument();
    const counter = within(dialog).getByText('2 / 11');
    expect(counter).toHaveClass('text-white/60');
    expect(counter).not.toHaveClass('ink-muted');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveTextContent('Close');
    const stage = within(dialog).getByRole('img', { name: `${TITLE}, photograph 2 of 11` });
    expect(stage).toHaveClass('object-contain');
    expect(
      within(dialog).getByText(`${TITLE}, photograph 2 of 11`, { selector: 'p' }),
    ).toBeVisible();
  });

  it('opens from a thumbnail on that thumbnail', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(18)} primaryIndex={0} />);

    const dialog = await openViewer(user, 'Open photo 3 of 18');
    expect(within(dialog).getByText('3 / 18')).toBeInTheDocument();
  });

  it('lists every photograph in a numbered rail, marks the current one and jumps on click', async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(11)} primaryIndex={1} />);
    const dialog = await openViewer(user, /^View all/);

    const rail = within(within(dialog).getByRole('navigation', { name: 'All photos' }));
    const cells = rail.getAllByRole('button');
    expect(cells).toHaveLength(11);
    expect(cells[0]).toHaveTextContent('01');
    expect(cells[10]).toHaveTextContent('11');
    expect(cells[1]).toHaveAttribute('aria-current', 'true');
    expect(cells[1]).toHaveClass('border-(--color-accent)');
    expect(scrollIntoView).toHaveBeenCalled();

    await user.click(rail.getByRole('button', { name: 'Photo 7 of 11' }));
    expect(within(dialog).getByText('7 / 11')).toBeInTheDocument();
    expect(rail.getByRole('button', { name: 'Photo 7 of 11' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(cells[1]).not.toHaveAttribute('aria-current');
  });

  it('pages with its arrows and the arrow keys, wrapping at both ends, without closing', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);
    const dialog = await openViewer(user, /^View all/);

    await user.click(within(dialog).getByRole('button', { name: 'Previous photo' }));
    expect(within(dialog).getByText('3 / 3')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Next photo' }));
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(within(dialog).getByText('3 / 3')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('locks the page behind it while open, and releases it on close', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);

    await openViewer(user, /^View all/);
    expect(document.body).toHaveAttribute('data-scroll-locked');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.body).not.toHaveAttribute('data-scroll-locked'));
  });

  it('closes on Escape and returns focus to the thumbnail that opened it', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(4)} primaryIndex={0} />);

    await openViewer(user, 'Open photo 3 of 4');
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open photo 3 of 4' })).toHaveFocus();
  });

  it('closes with its button and returns focus to the main image', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);

    const dialog = await openViewer(user, /^View all/);
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^View all/ })).toHaveFocus();
  });

  it('keeps focus inside while open', async () => {
    const user = userEvent.setup();
    render(
      <>
        <a href="/elsewhere">Elsewhere</a>
        <VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />
      </>,
    );
    const dialog = await openViewer(user, /^View all/);

    for (let press = 0; press < 8; press += 1) {
      await user.tab();
      expect(dialog).toContainElement(
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
      );
    }
  });

  it('shows no arrows for a single photograph and ignores the arrow keys', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(1)} primaryIndex={0} />);
    const dialog = await openViewer(user, `View the photo of ${TITLE}`);
    expect(within(dialog).queryByRole('button', { name: /Previous|Next/ })).toBeNull();
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByText('1 / 1')).toBeInTheDocument();
  });
});

describe('the helpers', () => {
  it('wraps an index at both ends', () => {
    expect(wrapIndex(-1, 3)).toBe(2);
    expect(wrapIndex(3, 3)).toBe(0);
    expect(wrapIndex(1, 3)).toBe(1);
    expect(wrapIndex(5, 0)).toBe(0);
  });

  it('starts on the primary when it is in range', () => {
    expect(startIndex(2, 3)).toBe(2);
    expect(startIndex(3, 3)).toBe(0);
    expect(startIndex(-1, 3)).toBe(0);
  });

  it('reads only the two arrow keys', () => {
    expect(arrowStep('ArrowLeft')).toBe(-1);
    expect(arrowStep('ArrowRight')).toBe(1);
    expect(arrowStep('ArrowUp')).toBeNull();
  });

  it('knows when the strip is at either end', () => {
    expect(stripEdges({ scrollLeft: 0, clientWidth: 500, scrollWidth: 1200 })).toEqual({
      atStart: true,
      atEnd: false,
    });
    expect(stripEdges({ scrollLeft: 700, clientWidth: 500, scrollWidth: 1200 })).toEqual({
      atStart: false,
      atEnd: true,
    });
    expect(stripEdges({ scrollLeft: 0, clientWidth: 500, scrollWidth: 500 })).toEqual({
      atStart: true,
      atEnd: true,
    });
  });

  it('says how far to scroll to reveal a thumbnail, and nothing when it is in view', () => {
    const track = { left: 100, right: 500 };
    expect(revealOffset(track, { left: 200, right: 300 })).toBe(0);
    expect(revealOffset(track, { left: 460, right: 568 })).toBe(68);
    expect(revealOffset(track, { left: 40, right: 148 })).toBe(-60);
  });

  it('numbers the rail with two digits', () => {
    expect(railNumber(0)).toBe('01');
    expect(railNumber(10)).toBe('11');
  });
});
