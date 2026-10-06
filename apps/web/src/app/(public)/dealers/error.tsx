'use client';

import { ROUTE_ERROR_TEXT, RouteError } from '@/components/errors/route-error';

export default function DealersError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} description={ROUTE_ERROR_TEXT.dealers} />;
}
