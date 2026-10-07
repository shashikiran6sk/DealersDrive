# PR10 — MSG91 SMS acknowledgement for support requests (R118) — NOT MERGED

This PR was deliberately left open for human review, as instructed.

| File | What it shows |
| --- | --- |
| `01-delivery-log-desktop.png` | "Message deliveries": the SMS row (`SMS` tag, proved number, "Support request DD-1003 received") beside the support desk emails |
| `02-delivery-log-mobile-fixed.png` | The same at 390 px, after the layout fix. Before it, the recipient column collapsed and broke addresses one letter per line (the page was ~19,700 px tall; now ~6,700 px) |
| `migration.sql` | `20261007120000_notification_channel`, additive |
| `journey.sh`, `journey.log` | The manual journey against the local stack (`SMS_DRIVER=console`) |
| `tests.txt` | SMS integration + SMS/adapter/env/notification unit tests, verbose (232 passed) |

## Manual journey (local API + pg-boss worker, `SMS_DRIVER=console`)

1. **A phone-only customer signs up and raises `DD-1003`.** They have no email
   at all.
   - Deliveries: one `SMS` row, `sms.support.ticket-ack`, to the proved number,
     SENT on the first attempt, with no dealership.
   - The support desk emails went to the Super admin and priya.
   - There was no customer email, because the customer has no verified address.
     That gap is exactly what this SMS covers.
2. **Support moves the request to In progress.** No second SMS.
3. **Console driver log line.** It shows only the masked number, the template
   and the variables:
   `{'msg': 'sms (not sent)', 'driver': 'console', 'to': '••••••••0784', 'tag': 'sms.support.ticket-ack', 'templateId': 'unset', 'variables': {'reference': 'DD-1003'}}`.
   The full number appears 0 times in the API log.

## Boot-time configuration checks (real processes)

| Configuration | Result |
| --- | --- |
| `NODE_ENV=production SMS_DRIVER=console` | refused: "must be `msg91` or `disabled` in production — `console` sends nothing…" |
| `SMS_DRIVER=msg91` without key or template | refused, naming `MSG91_AUTH_KEY` and `MSG91_TICKET_ACK_TEMPLATE_ID` |
| `NODE_ENV=test SMS_DRIVER=msg91`, fully configured | refused: "must not be `msg91` under test — the suite never sends a real SMS" |
| development, `msg91` configured | boots |
| development default | boots on `console` |

## Migration

- Applied to the dev database with `prisma migrate deploy`.
- The 23 existing rows were backfilled as `EMAIL` by the column default.
- `prisma migrate diff --from-config-datasource --to-schema` shows no drift for
  `channel`. Its only line is a pre-existing `vehicle_media` index that an
  earlier migration created in raw SQL; it is unrelated to this PR.

## What was not done, and why

- **No real SMS was sent.** Sending one needs an MSG91 account with a
  DLT-approved template and its Flow id, which are not available here. The
  user's instructions say never to send real messages in tests.
- **The MSG91 adapter is covered by unit tests with a fake `fetch`:**
  - the request shape: endpoint, `authkey` header, `template_id`, `short_url`,
    `mobiles` without the plus, the variables
  - success returns the provider id
  - 401, and a 200 carrying `type: error`, are permanent
  - 500, 503, 429 and an unreachable host are retried
- **Before enabling in production:**
  1. Register the DLT template, with the variable `##reference##`.
  2. Create the MSG91 Flow.
  3. Set `MSG91_TICKET_ACK_TEMPLATE_ID`, then `SMS_DRIVER=msg91` (Terraform
     `sms_driver`, default `disabled`).
  4. Run one acknowledgement against a staff phone.
