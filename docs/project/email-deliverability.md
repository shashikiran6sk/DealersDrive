# Transactional email deliverability

## What the September 12 incident proves

The reported profile-change message was accepted by Resend and assigned a
provider message id, but it was initially found in Gmail spam. Those facts are
compatible: Resend marks a message delivered when the recipient mail server
accepts it, while that server can still put it in Inbox, Spam, a queue, or
discard it. Inbox providers do not report that later classification to Resend.
See Resend's [delivered-but-not-received explanation](https://resend.com/docs/knowledge-base/what-if-an-email-says-delivered-but-the-recipient-has-not-received-it)
and [email event definitions](https://resend.com/docs/dashboard/emails/introduction).

Two actionable configuration problems were visible in the message:

- it was sent as `onboarding@resend.dev`; Resend documents `resend.dev` as a
  [test-only shared domain](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain);
- this development environment built email actions from
  `WEB_BASE_URL=http://localhost:3000`. Resend's
  [deliverability insights](https://resend.com/docs/dashboard/emails/deliverability-insights)
  warn that link domains should match the sending domain and that mismatched
  links can trigger spam filters.

The public DNS check on 2026-09-12 found a Google Workspace SPF record on
`dealers-drive.com`, but no DMARC record and no Resend DKIM or return-path
records at the names checked. That does **not** describe the authentication of
the incident message, because its visible sender was `resend.dev`. It means
the Dealers-Drive domain is not yet ready to replace that test sender through
Resend.

The exact Gmail rule that classified this one message remains unproven without
Gmail's “Why is this message in spam?” text and the `Authentication-Results`
header from “Show original.” Other templates arriving in Inbox does not make
the shared test sender, localhost link, or domain reputation safe.

## Code safeguards

When `MAIL_DRIVER=resend`, startup now logs
`mail.deliverability.configuration` warnings for the shared `resend.dev`
sender and for a non-public or non-HTTPS `WEB_BASE_URL`. Production refuses
to boot with either condition, with a malformed sender, or with a no-reply
sender. The Resend request includes `reply_to=SUPPORT_EMAIL`, and successful
API responses are logged as “email accepted by provider” rather than “email
sent.”

These checks catch configuration mistakes. They do not claim to test DNS,
sender reputation, Gmail policy, or inbox placement.

## Production setup

1. Add a sending domain or dedicated subdomain in Resend. Resend recommends a
   subdomain to isolate reputation.
2. Publish exactly the SPF and DKIM records shown for that domain in the Resend
   dashboard and wait until its status is verified. A verified Resend domain
   passes SPF and DKIM; see [Managing Domains](https://resend.com/docs/dashboard/domains/introduction).
3. Publish DMARC at `_dmarc.<domain>`, begin with `p=none`, inspect reports,
   and only then move to enforcement. Follow Resend's
   [DMARC procedure](https://resend.com/docs/dashboard/domains/dmarc).
4. Set `MAIL_FROM` to a monitored address on the verified domain, for example
   `Dealers-Drive <updates@dealers-drive.com>`.
5. Set `WEB_BASE_URL` to the public HTTPS application origin. Keep every
   action link on the same organizational domain as the sender.
6. In Resend Deliverability Insights, verify DMARC, link-domain, plain-text,
   body-size, and tracking recommendations. Both HTML and plain-text bodies are
   already emitted by this application.
7. Send low, steady volumes while the domain builds reputation. Monitor bounce
   and complaint events; do not infer inbox placement from an API 2xx or a
   provider message id.

## Investigating a future message

Use the `providerMessageId` stored in `notification_deliveries` to find the
message in Resend. Record its event timeline and Deliverability Insights. In
Gmail, record the spam explanation and, from “Show original,” the SPF, DKIM,
and DMARC results. Compare the visible From domain, DKIM signing domain,
return-path domain, and every URL in both message bodies.

Do not paste API keys, session tokens, or the full recipient address into an
issue. A send-only Resend API key cannot retrieve message details; use the
dashboard or a separately scoped read credential rather than widening the
application key.
