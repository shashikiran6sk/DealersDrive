'use client';

import { Analytics } from '@vercel/analytics/next';
import { usePathname } from 'next/navigation';

import { isPublicAnalyticsPath, publicAnalyticsEvent } from '@/lib/public-analytics';

export function PublicAnalytics() {
  const path = usePathname();
  if (!path || !isPublicAnalyticsPath(path)) return null;
  return <Analytics beforeSend={publicAnalyticsEvent} />;
}
