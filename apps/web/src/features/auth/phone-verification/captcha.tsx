/**
 * Where MSG91 renders its captcha when it decides one is needed.
 *
 * The element has to exist *before* `initSendOTP` runs — `captchaRenderId` is
 * looked up by id — so it is rendered unconditionally rather than in response to
 * a challenge that has already been missed. `empty:hidden` keeps it out of the
 * layout until the widget puts something in it.
 */
export function Captcha({ id }: { id: string }) {
  return <div id={id} className="mb-[12px] empty:hidden" />;
}
