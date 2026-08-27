import { SkeletonLines } from '@/components/ui/primitives';

/**
 * A Suspense boundary for the buyer shell, and not only a nicety.
 *
 * Without one, a page's own data fetch resolves while Next is still building
 * the initial shell — and a throw there has no partial document to fall back
 * into, so Next abandons the render and serves its own error document instead
 * of `(public)/error.tsx`. Marking the boundary lets the header and footer
 * flush first, which is what gives the error boundary somewhere to render.
 */
export default function PublicLoading() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-20">
      <SkeletonLines />
    </div>
  );
}
