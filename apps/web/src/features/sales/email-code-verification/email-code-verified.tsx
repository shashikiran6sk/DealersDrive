import { StatusTag } from '@/components/ui/primitives';

import { EMAIL_CODE_TEXT } from './email-code-verification.constants';

export function EmailCodeVerified({ email }: { email: string }) {
  return (
    <section
      aria-live="polite"
      className="border border-[color-mix(in_srgb,#0f7a5a_30%,transparent)] bg-(--color-ok-bg) px-[18px] py-[16px]"
    >
      <div className="flex flex-wrap items-center gap-[12px]">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-(--color-ok)">
            {EMAIL_CODE_TEXT.verifiedTitle}
          </h3>
          <p className="mt-[2px] text-[13px] break-words ink-body">
            {EMAIL_CODE_TEXT.verifiedBody(email)}
          </p>
        </div>
        <StatusTag tone="ok">{EMAIL_CODE_TEXT.verifiedTag}</StatusTag>
      </div>
    </section>
  );
}
