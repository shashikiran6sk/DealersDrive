import Link from 'next/link';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { cn } from '@/lib/cn';

import { buttonClass, type ButtonVariants } from './button.variants';

export type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonVariants & { href: string; children: ReactNode };

export function ButtonLink({
  className,
  variant,
  size,
  block,
  href,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      {...props}
      className={buttonClass({ variant, size, block, className: cn('relative', className) })}
    >
      <LinkPendingLabel>{children}</LinkPendingLabel>
    </Link>
  );
}
