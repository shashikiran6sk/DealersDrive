import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Dialog } from '@/components/ui/dialog';

/**
 * DESIGN-SPEC §2.14, and component-map finding **D-C**.
 *
 * The baseline carried `.dialog` CSS with zero consumers and drew its one real
 * dialog with Radix — two strategies, one of them dead. `Dialog` is the
 * resolution: Radix underneath, the design system's classes on top. So what is
 * worth testing here is the *contract that made Radix the right answer*, not
 * Radix itself — the four things a hand-rolled modal gets wrong and only a
 * screen-reader or keyboard user ever notices.
 *
 * Tested once, at the primitive. A screen that opens a dialog does not re-test
 * the trap; it tests what is inside it.
 */
function Harness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button">Behind</button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        trigger={<button type="button">Open</button>}
        title="Select location"
        description="Choose a district"
        closeLabel="Close location picker"
        footer={<button type="button">Footer action</button>}
      >
        <button type="button">Inside</button>
      </Dialog>
    </>
  );
}

describe('the dialog contract', () => {
  it('is a modal dialog, named and described by its own header', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Select location');
    expect(dialog).toHaveAccessibleDescription('Choose a district');
  });

  /** §4.15 — every icon-only control needs a name. The ✕ is icon-only. */
  it('names the close button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('button', { name: 'Close location picker' })).toBeInTheDocument();
  });

  it('moves focus into the dialog when it opens', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  /**
   * The trap. Tabbing off the last control returns to the first rather than
   * walking out into a page the dialog has made inert — which is the failure
   * mode a hand-rolled modal has and nobody with a mouse ever sees.
   */
  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('hides the rest of the document from a screen reader', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.queryByRole('button', { name: 'Behind' })).toBeNull();
  });

  it('closes on Escape and hands focus back to whatever opened it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    // Radix restores focus after the panel unmounts, which is a frame later.
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('closes on the close button, and restores focus the same way', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    await user.click(screen.getByRole('button', { name: 'Close location picker' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  /** Header, scrolling body and footer are three regions, and all three render. */
  it('renders its footer alongside its content', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('button', { name: 'Inside' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Footer action' })).toBeInTheDocument();
  });
});
