import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button, ButtonLink, buttonClass } from '../../../../src/components/ui/button.js';

/**
 * DESIGN-SPEC §2.1: one `btn-primary` per view — the single forward action.
 * A variant is a *product* decision encoded as a class name, so the tests here
 * check that the decision survives to the DOM.
 *
 * The loading state is the part that carries real weight: it keeps the width,
 * swaps the label for a spinner and sets `aria-busy`. Losing the width makes
 * the layout jump under the user's cursor mid-submit; losing `aria-busy` means
 * a screen reader announces nothing at all while a form is in flight.
 */

describe('buttonClass', () => {
  it('always emits the base class', () => {
    expect(buttonClass({})).toContain('btn');
  });

  it('defaults to the secondary variant, not the primary one', () => {
    expect(buttonClass({})).toContain('btn-secondary');
    expect(buttonClass({})).not.toContain('btn-primary');
  });

  it.each([
    ['primary', 'btn-primary'],
    ['secondary', 'btn-secondary'],
    ['ghost', 'btn-ghost'],
    ['destructive', 'btn-destructive'],
    ['danger', 'btn-danger-solid'],
  ] as const)('renders the %s variant', (variant, expected) => {
    expect(buttonClass({ variant })).toContain(expected);
  });

  it('adds a block modifier only when asked', () => {
    expect(buttonClass({ block: true })).toContain('btn-block');
    expect(buttonClass({ block: false })).not.toContain('btn-block');
  });

  it('lets a caller override a variant class', () => {
    expect(buttonClass({ variant: 'primary', className: 'w-full' })).toContain('w-full');
  });

  it.each(['sm', 'md', 'lg', 'hero'] as const)('applies the %s size', (size) => {
    expect(buttonClass({ size }).length).toBeGreaterThan('btn btn-secondary'.length);
  });

  it('emits no size classes at the default size', () => {
    expect(buttonClass({ size: 'default' }).trim()).toBe('btn btn-secondary');
  });
});

describe('Button', () => {
  it('renders its label', () => {
    render(<Button>Save changes</Button>);

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('calls onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Submit</Button>);

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('forwards the button type, so a button in a form does not submit by accident', () => {
    render(<Button type="button">Cancel</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('is disabled when told to be', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Submit
      </Button>,
    );

    expect(screen.getByRole('button')).toBeDisabled();
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('carries the variant class into the DOM', () => {
    render(<Button variant="primary">Publish</Button>);

    expect(screen.getByRole('button').className).toContain('btn-primary');
  });
});

describe('Button in flight', () => {
  /** Without aria-busy a screen reader announces nothing while a form submits. */
  it('marks itself busy', () => {
    render(<Button loading>Save</Button>);

    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('is not busy at rest', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy', 'true');
  });

  /** A double-submit is a duplicate listing, or a second charge. */
  it('cannot be clicked while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );

    await userEvent.click(screen.getByRole('button'));

    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows a spinner in place of the label', () => {
    const { container } = render(<Button loading>Save changes</Button>);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  /**
   * Pinned as *current* behaviour, not as desired behaviour. The prop's own
   * docblock says "keeps width, swaps the label for a spinner" (DESIGN-SPEC
   * §2.1), but the label is removed from the DOM rather than hidden — so the
   * button collapses to the spinner's width and the layout shifts under the
   * user's cursor mid-submit. Holding the width would mean rendering the label
   * invisibly behind an absolutely-positioned spinner; that is a visual change
   * and belongs in a change someone can look at, not in a test fix.
   */
  it('currently drops the label, so the button does not hold its width', () => {
    const { container } = render(<Button loading>Save changes</Button>);

    expect(container.textContent).not.toContain('Save changes');
  });
});

describe('ButtonLink', () => {
  it('renders an anchor, not a button', () => {
    render(<ButtonLink href="/cars">Browse cars</ButtonLink>);

    const link = screen.getByRole('link', { name: 'Browse cars' });
    expect(link).toHaveAttribute('href', '/cars');
  });

  it('carries the variant class', () => {
    render(
      <ButtonLink href="/cars" variant="primary">
        Browse
      </ButtonLink>,
    );

    expect(screen.getByRole('link').className).toContain('btn-primary');
  });

  /**
   * A navigation is a link, not a button. That is what gives it a middle-click,
   * a right-click menu and a keyboard focus order for free.
   */
  it('is a link so it can be opened in a new tab', () => {
    render(<ButtonLink href="/dealers">Dealers</ButtonLink>);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
