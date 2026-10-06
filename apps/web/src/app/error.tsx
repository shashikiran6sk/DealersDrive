'use client';

import { RouteError } from '@/components/errors/route-error';
import { StatusShell } from '@/components/errors/status-shell';

export default function RootError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusShell>
      <RouteError {...props} />
    </StatusShell>
  );
}
