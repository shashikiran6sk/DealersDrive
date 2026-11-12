import type { ReactNode } from 'react';

import { PageSlot } from '@/components/layout/page-slot';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <PageSlot>{children}</PageSlot>
    </div>
  );
}
