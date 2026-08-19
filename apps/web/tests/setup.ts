import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Everything Next.js provides at runtime that does not exist in a test
 * process, stubbed once here rather than in every file.
 *
 * The three that matter, and why each is a fake rather than an avoidance:
 *
 * **`next/navigation`** — `useRouter`, `usePathname` and `useSearchParams`
 * throw outside the App Router. The filter panel and the toolbar exist to
 * *write to the URL* (§15.2: search state lives in the URL and nowhere else),
 * so a fake router that records what it was pushed is the only way to assert
 * the thing those components are for. `navigationState` below is how a test
 * sets the current URL and reads back the navigation that resulted.
 *
 * **`next/headers`** — server actions forward the buyer's IP so the API's
 * per-IP rate limits count the buyer rather than counting the Next server once
 * for the whole internet (§14.1). That forwarding is a security behaviour, and
 * testing it needs a `headers()` that returns something.
 *
 * **`next/cache`** — `revalidatePath` and `revalidateTag` are how a mutation
 * becomes visible. Recording the calls lets a test assert that an action
 * invalidated what it changed, which is otherwise invisible until production.
 */

export interface NavigationState {
  pathname: string;
  searchParams: URLSearchParams;
  pushed: string[];
  replaced: string[];
  refreshed: number;
  back: number;
}

export const navigationState: NavigationState = {
  pathname: '/',
  searchParams: new URLSearchParams(),
  pushed: [],
  replaced: [],
  refreshed: 0,
  back: 0,
};

/** Sets the URL a component under test believes it is rendering at. */
export function setLocation(pathname: string, search = ''): void {
  navigationState.pathname = pathname;
  navigationState.searchParams = new URLSearchParams(search);
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (url: string) => navigationState.pushed.push(url),
    replace: (url: string) => navigationState.replaced.push(url),
    refresh: () => {
      navigationState.refreshed += 1;
    },
    back: () => {
      navigationState.back += 1;
    },
    forward: () => undefined,
    prefetch: () => undefined,
  }),
  usePathname: () => navigationState.pathname,
  useSearchParams: () => navigationState.searchParams,
  redirect: (url: string) => {
    // The real one throws a special error that unwinds the render. A plain
    // throw is enough here, and carries the destination so a test can assert it.
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

export const requestHeaders = new Map<string, string>();
export const cookieJar = new Map<string, string>();

vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve({
      get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null,
      has: (name: string) => requestHeaders.has(name.toLowerCase()),
      entries: () => requestHeaders.entries(),
      forEach: (fn: (value: string, key: string) => void) => {
        requestHeaders.forEach(fn);
      },
    }),
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = cookieJar.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set: (name: string, value: string) => cookieJar.set(name, value),
      delete: (name: string) => cookieJar.delete(name),
    }),
}));

export const revalidations: { paths: string[]; tags: string[] } = { paths: [], tags: [] };

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidations.paths.push(path),
  revalidateTag: (tag: string) => revalidations.tags.push(tag),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

/**
 * `next/link` renders an anchor. The real one adds prefetching and client-side
 * navigation, neither of which a unit test observes — but the `href` is
 * exactly what these tests assert on, so it has to survive.
 */
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string | { pathname: string };
  } & Record<string, unknown>) =>
    createElement(
      'a',
      { href: typeof href === 'string' ? href : href.pathname, ...rest },
      children,
    ),
}));

/**
 * `next/image` applies its own optimisation pipeline and rejects props a plain
 * `<img>` accepts. Rendering an `<img>` keeps `alt` and `src` assertable —
 * and alt text is an accessibility claim worth asserting.
 */
vi.mock('next/image', () => ({
  default: ({ alt, src, ...rest }: { alt: string; src: string } & Record<string, unknown>) => {
    const { priority, fill, quality, placeholder, blurDataURL, loader, unoptimized, ...safe } =
      rest as Record<string, unknown>;
    void priority;
    void fill;
    void quality;
    void placeholder;
    void blurDataURL;
    void loader;
    void unoptimized;
    return createElement('img', { alt, src, ...safe });
  },
}));

/** jsdom implements neither, and the gallery calls both. */
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();

  navigationState.pathname = '/';
  navigationState.searchParams = new URLSearchParams();
  navigationState.pushed.length = 0;
  navigationState.replaced.length = 0;
  navigationState.refreshed = 0;
  navigationState.back = 0;

  requestHeaders.clear();
  cookieJar.clear();
  revalidations.paths.length = 0;
  revalidations.tags.length = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
