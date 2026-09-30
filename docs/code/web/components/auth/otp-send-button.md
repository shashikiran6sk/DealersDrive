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

### `<span data-slot="whatsapp-icon" className="inline-flex flex-none">`

The logo on its own, in its own colours, straight on the dark button, with no
disc or badge behind it. The monochrome `SocialIcon` glyph it replaced was too
small and took the button's text colour, so it read as a decoration rather than
as WhatsApp.

The mark is `aria-hidden`. Its meaning is given to assistive technology by the
`sr-only` "on WhatsApp" after the label instead, so the accessible name is
"Send OTP on WhatsApp" while the logo shows and "Send OTP" while it does not.

### `{' '}`

A separate text node rather than a leading space inside the `sr-only` span:
the accessible-name computation trims each element's text, and a space inside
the span would be lost, reading "Send OTPon WhatsApp".

## `apps/web/src/components/auth/otp-send-button/whatsapp-mark.tsx`

### `export function WhatsAppMark()`

The WhatsApp logo at 24px: a bubble in WhatsApp green (`WHATSAPP_GREEN`,
`#25D366`) with the handset in white. It is drawn as two shapes, the solid
bubble and then the white handset, so it needs no background of its own.
