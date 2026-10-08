'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function WebsiteLink({ url }: { url: string }) {
  const [message, setMessage] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 break-all text-[14px] underline underline-offset-4"
      >
        {url}
      </a>
      <Button
        variant="secondary"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(
            () => setMessage('Link copied.'),
            () => setMessage('Could not copy. Select the link to copy it.'),
          );
        }}
      >
        Copy link
      </Button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center text-[13px] underline"
      >
        Open website ↗
      </a>
      {message ? (
        <span role="status" className="text-[12px] ink-muted">
          {message}
        </span>
      ) : null}
    </div>
  );
}
