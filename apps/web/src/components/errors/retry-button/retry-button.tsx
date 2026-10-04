'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button, type ButtonVariants } from '@/components/ui/button';
import { STATUS_TEXT } from '@/components/errors/status-page';

export interface RetryButtonProps {
  onRetry?: () => void;
  variant?: ButtonVariants['variant'];
  size?: ButtonVariants['size'];
  className?: string;
}

export function RetryButton({
  onRetry,
  variant = 'primary',
  size = 'lg',
  className,
}: RetryButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      loading={pending}
      aria-label={pending ? STATUS_TEXT.retrying : undefined}
      onClick={() => {
        startTransition(() => {
          router.refresh();
          onRetry?.();
        });
      }}
    >
      {STATUS_TEXT.retry}
    </Button>
  );
}
