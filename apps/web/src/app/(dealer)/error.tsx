'use client';

import { ROUTE_ERROR_TEXT, RouteError } from '@/components/errors/route-error';
import { StatusShell } from '@/components/errors/status-shell';

export default function DealerConsoleError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusShell>
      <RouteError
        {...props}
        description={ROUTE_ERROR_TEXT.console}
        homeHref={ROUTE_ERROR_TEXT.dashboardHref}
        homeLabel={ROUTE_ERROR_TEXT.dashboard}
      />
    </StatusShell>
  );
}
