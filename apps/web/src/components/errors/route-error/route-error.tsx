'use client';

import { RetryButton } from '@/components/errors/retry-button';
import { STATUS_LINKS, STATUS_TEXT, StatusPage } from '@/components/errors/status-page';
import { ButtonLink } from '@/components/ui/button';
import { SITE_NAME } from '@/lib/seo/seo.constants';

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
}

export function RouteError({
  error,
  reset,
  description = STATUS_TEXT.error.description,
  homeHref = STATUS_LINKS.home,
  homeLabel = STATUS_TEXT.home,
}: RouteErrorProps) {
  return (
    <>
      <title>{`${STATUS_TEXT.error.metaTitle} | ${SITE_NAME}`}</title>
      <meta name="robots" content="noindex" />
      <StatusPage
        code={STATUS_TEXT.error.code}
        title={STATUS_TEXT.error.title}
        description={description}
        reference={error.digest}
        actions={
          <>
            <RetryButton onRetry={reset} />
            <ButtonLink href={homeHref} variant="secondary" size="lg">
              {homeLabel}
            </ButtonLink>
          </>
        }
      />
    </>
  );
}
