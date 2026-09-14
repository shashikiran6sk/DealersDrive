import type { ReactNode } from 'react';

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-[26px]">
      <h1 className="font-heading text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]">
        {title}
      </h1>
      {children ? (
        <p className="mt-[10px] text-[15px] leading-[1.5] ink-secondary">{children}</p>
      ) : null}
    </div>
  );
}
