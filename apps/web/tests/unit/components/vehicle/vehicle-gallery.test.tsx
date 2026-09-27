import type { PublicVehicleImage } from '@dealers-drive/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { VehicleGallery } from '@/components/vehicle/vehicle-gallery';
import { arrowStep, startIndex, wrapIndex } from '@/components/vehicle/vehicle-gallery/utils';

const TITLE = '2023 Hyundai Creta SX(O)';

function images(count: number): PublicVehicleImage[] {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://media.test/by-media/m${index}/1024.webp`,
    alt: `${TITLE}, photograph ${index + 1} of ${count}`,
  }));
}

function mainImage(): HTMLElement {
  return within(screen.getByRole('region', { name: 'Photographs' })).getByRole('img');
}

function counter(): string | null {
  return within(screen.getByRole('region', { name: 'Photographs' })).getByText(/\d+ \/ \d+/)
    .textContent;
}

describe('the gallery on the page', () => {
  it('opens on the primary photograph', () => {
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={1} />);
    expect(mainImage()).toHaveAttribute('src', 'https://media.test/by-media/m1/1024.webp');
    expect(counter()).toBe('2 / 3');
  });

  it('moves with the arrows and wraps at both ends, as the legacy gallery did', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);

    await user.click(screen.getByRole('button', { name: 'Previous photograph' }));
    expect(counter()).toBe('3 / 3');
    await user.click(screen.getByRole('button', { name: 'Next photograph' }));
    expect(counter()).toBe('1 / 3');
    await user.click(screen.getByRole('button', { name: 'Next photograph' }));
    expect(mainImage()).toHaveAttribute('alt', `${TITLE}, photograph 2 of 3`);
  });

  it('does not open the fullscreen viewer when an arrow is pressed', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);

    await user.click(screen.getByRole('button', { name: 'Next photograph' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('answers ← and → while the gallery has focus, and only then', async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="Elsewhere" />
        <VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />
      </>,
    );

    await user.click(screen.getByRole('textbox', { name: 'Elsewhere' }));
    await user.keyboard('{ArrowRight}');
    expect(counter()).toBe('1 / 3');

    screen.getByRole('button', { name: 'View photograph 1 of 3 fullscreen' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(counter()).toBe('2 / 3');
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(counter()).toBe('3 / 3');
  });

  it('reaches every control by keyboard, in order', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);

    await user.tab();
    expect(screen.getByRole('button', { name: /fullscreen/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Previous photograph' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next photograph' })).toHaveFocus();
  });

  it('offers no arrows for a single photograph', () => {
    render(<VehicleGallery title={TITLE} images={images(1)} primaryIndex={0} />);
    expect(screen.queryByRole('button', { name: /Previous|Next/ })).not.toBeInTheDocument();
    expect(counter()).toBe('1 / 1');
  });

  it('holds the frame with a labelled slot when there are none, and survives a bad index', () => {
    const { rerender } = render(<VehicleGallery title={TITLE} images={[]} primaryIndex={0} />);
    expect(screen.getByRole('img', { name: 'Photographs coming soon' })).toBeInTheDocument();

    rerender(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={9} />);
    expect(counter()).toBe('1 / 3');
  });
});

describe('the fullscreen viewer', () => {
  it('opens on the photograph shown, with a counter, the title and a close button', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(18)} primaryIndex={2} />);

    await user.click(screen.getByRole('button', { name: 'View photograph 3 of 18 fullscreen' }));

    const dialog = await screen.findByRole('dialog', { name: `${TITLE} — photographs` });
    expect(within(dialog).getByText('3 / 18')).toBeInTheDocument();
    expect(within(dialog).getByRole('img')).toHaveAttribute(
      'src',
      'https://media.test/by-media/m2/1024.webp',
    );
    expect(within(dialog).getByRole('img')).toHaveClass('object-contain');
    expect(within(dialog).getByRole('button', { name: 'Close photographs' })).toBeInTheDocument();
  });

  it('locks the page behind it while open, and releases it on close', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);

    await user.click(screen.getByRole('button', { name: /fullscreen/ }));
    await screen.findByRole('dialog');
    expect(document.body).toHaveAttribute('data-scroll-locked');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.body).not.toHaveAttribute('data-scroll-locked'));
  });

  it('pages with its arrows and the arrow keys, wrapping, without closing', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);
    await user.click(screen.getByRole('button', { name: /fullscreen/ }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Next photograph' }));
    expect(within(dialog).getByText('2 / 3')).toBeInTheDocument();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(within(dialog).getByText('1 / 3')).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(within(dialog).getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the image that opened it', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);
    const opener = screen.getByRole('button', { name: /fullscreen/ });

    await user.click(opener);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /fullscreen/ })).toHaveFocus();
  });

  it('closes with its button and leaves the page on the photograph last viewed', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />);

    await user.click(screen.getByRole('button', { name: /fullscreen/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Next photograph' }));
    await user.click(within(dialog).getByRole('button', { name: 'Close photographs' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(counter()).toBe('2 / 3');
  });

  it('keeps focus inside while open', async () => {
    const user = userEvent.setup();
    render(
      <>
        <a href="/elsewhere">Elsewhere</a>
        <VehicleGallery title={TITLE} images={images(3)} primaryIndex={0} />
      </>,
    );
    await user.click(screen.getByRole('button', { name: /fullscreen/ }));
    const dialog = await screen.findByRole('dialog');

    for (let press = 0; press < 6; press += 1) {
      await user.tab();
      expect(dialog).toContainElement(
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
      );
    }
  });

  it('shows no arrows for a single photograph', async () => {
    const user = userEvent.setup();
    render(<VehicleGallery title={TITLE} images={images(1)} primaryIndex={0} />);
    await user.click(screen.getByRole('button', { name: /fullscreen/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /Previous|Next/ })).not.toBeInTheDocument();
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
    expect(arrowStep('Enter')).toBeNull();
  });
});
