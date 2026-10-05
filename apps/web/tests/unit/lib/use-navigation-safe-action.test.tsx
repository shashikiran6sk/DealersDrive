import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { navigationState } from '../../setup';

import {
  useNavigationSafeAction,
  useNavigationSafeFormAction,
} from '@/lib/use-navigation-safe-action';

/**
 * A mutation run inside an async React transition holds every other transition
 * — including a `<Link>` navigation — until it settles (React 19 entangles them).
 * These hooks run the mutation outside a transition, so the console stays
 * navigable while a slow request is in flight, and carry out a server-action
 * `redirect()` themselves, unless the person has already gone somewhere else.
 */
function redirectError(href: string, type = 'push') {
  return Object.assign(new Error('NEXT_REDIRECT'), {
    digest: `NEXT_REDIRECT;${type};${href};303;`,
  });
}

function deferred() {
  let resolve: () => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useNavigationSafeAction', () => {
  it('is pending for exactly as long as the work runs', async () => {
    const work = deferred();
    const { result } = renderHook(() => useNavigationSafeAction());
    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1](() => work.promise);
    });
    expect(result.current[0]).toBe(true);

    await act(async () => {
      work.resolve();
      await work.promise;
    });
    expect(result.current[0]).toBe(false);
  });

  it('follows a server-action redirect itself', async () => {
    const { result } = renderHook(() => useNavigationSafeAction());

    await act(async () => {
      result.current[1](() =>
        Promise.reject(redirectError('/dealer/vehicles/v1/edit?step=basics')),
      );
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(navigationState.pushed).toContain('/dealer/vehicles/v1/edit?step=basics'),
    );
  });

  it('replaces rather than pushes when the redirect asked to', async () => {
    const { result } = renderHook(() => useNavigationSafeAction());

    await act(async () => {
      result.current[1](() => Promise.reject(redirectError('/dealer', 'replace')));
      await Promise.resolve();
    });

    await waitFor(() => expect(navigationState.replaced).toContain('/dealer'));
    expect(navigationState.pushed).toEqual([]);
  });

  it('drops a late redirect when the person has already navigated away — the last click wins', async () => {
    const work = deferred();
    navigationState.pathname = '/dealer/vehicles/new';
    const { result, rerender } = renderHook(() => useNavigationSafeAction());

    act(() => {
      result.current[1](() => work.promise);
    });
    navigationState.pathname = '/dealer/inventory';
    rerender();

    await act(async () => {
      work.reject(redirectError('/dealer/vehicles/v1/edit'));
      await work.promise.catch(() => undefined);
    });

    expect(navigationState.pushed).toEqual([]);
    expect(result.current[0]).toBe(false);
  });

  it('hands any other failure to the nearest error boundary, as a transition would', async () => {
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      override state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      override render() {
        return this.state.failed ? <p>boundary caught it</p> : this.props.children;
      }
    }
    function Trigger() {
      const [, start] = useNavigationSafeAction();
      return (
        <button type="button" onClick={() => start(() => Promise.reject(new Error('API down')))}>
          go
        </button>
      );
    }
    const quiet = console.error;
    console.error = () => undefined;
    render(
      <Boundary>
        <Trigger />
      </Boundary>,
    );
    act(() => {
      screen.getByRole('button', { name: 'go' }).click();
    });
    expect(await screen.findByText('boundary caught it')).toBeInTheDocument();
    console.error = quiet;
  });
});

describe('useNavigationSafeFormAction', () => {
  it('submits the form data, with the button that was pressed, and keeps the state the action returns', async () => {
    const seen: string[] = [];
    function Form() {
      const [state, onSubmit, pending] = useNavigationSafeFormAction(
        (_previous: { message?: string }, formData: FormData) => {
          const text = (key: string) => {
            const value = formData.get(key);
            return typeof value === 'string' ? value : '';
          };
          seen.push(`${text('plate')}:${text('intent')}`);
          return Promise.resolve({ message: 'Not saved' });
        },
        {},
      );
      return (
        <form onSubmit={onSubmit}>
          <input name="plate" defaultValue="TN23AJ1245" />
          <button type="submit" name="intent" value="draft">
            Save draft
          </button>
          <p>{pending ? 'pending' : (state.message ?? 'idle')}</p>
        </form>
      );
    }
    render(<Form />);

    act(() => {
      screen.getByRole('button', { name: 'Save draft' }).click();
    });

    expect(await screen.findByText('Not saved')).toBeInTheDocument();
    expect(seen).toEqual(['TN23AJ1245:draft']);
  });
});
