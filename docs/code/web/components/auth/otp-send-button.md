# web / components/auth/otp-send-button

Parent: [web/components/auth](README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/auth/otp-send-button/otp-send-button.tsx`

### `export function OtpSendButton(`

The primary, full-width button that sends a one-time code, shared by the
login's phone sign-in (both tabs) and onboarding's mobile check (**R90**).

`whatsapp` is the admin's WhatsApp OTP switch — `otp.whatsappEnabled` in
`/admin/config`, carried to the browser as the single boolean
`whatsappOtpEnabled` on `GET /v1/config/public`. The page reads it on the
server and passes it down, so flipping the switch takes effect when the public
config cache is revalidated, with no redeploy and no `NEXT_PUBLIC_*`. No
provider setting or credential rides on it.

It decides the logo and nothing else: the label is the caller's, the flow is
unchanged, and delivery is still whatever the OTP driver does.

### `<span data-slot="whatsapp-icon" className="inline-flex">`

The mark is `SocialIcon`'s WhatsApp glyph, which is `aria-hidden`. Its meaning
is given to assistive technology by the `sr-only` "on WhatsApp" after the label
instead, so the accessible name is "Send OTP on WhatsApp" while the logo shows
and "Send OTP" while it does not.

### `{' '}`

A separate text node rather than a leading space inside the `sr-only` span:
the accessible-name computation trims each element's text, and a space inside
the span would be lost, reading "Send OTPon WhatsApp".
