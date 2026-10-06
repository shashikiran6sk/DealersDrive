'use client';

import { RouteError } from '@/components/errors/route-error';

export default function PublicError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} />;
}
