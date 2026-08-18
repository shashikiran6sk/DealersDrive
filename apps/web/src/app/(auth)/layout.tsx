import type { ReactNode } from 'react';

/**
 * DESIGN-SPEC §3.9 — the authentication screens sit on white, not on the
 * `#f4f5f7` page ground the rest of the product uses. The column inside is
 * `AuthShell`; this exists only to own the field it sits on, which no page
 * should have to set for itself.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-white">{children}</div>;
}
