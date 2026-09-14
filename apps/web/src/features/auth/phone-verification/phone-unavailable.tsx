import { PHONE_TEXT } from './phone-verification.constants';

/** The provider could not be reached, or the deployment has it switched off. */
export function PhoneUnavailable({ reason }: { reason?: string }) {
  return (
    <section
      role="status"
      className="border border-[color-mix(in_srgb,#a15c00_30%,transparent)] bg-(--color-warn-bg) px-[16px] py-[14px] text-[13px]"
    >
      <p className="font-semibold text-(--color-warn)">{PHONE_TEXT.unavailableTitle}</p>
      <p className="mt-[4px] ink-body">
        {reason ?? PHONE_TEXT.unavailableReason} {PHONE_TEXT.unavailableTail}
      </p>
    </section>
  );
}
