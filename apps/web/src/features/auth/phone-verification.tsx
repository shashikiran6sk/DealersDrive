'use client';

import { formatPhone, type PhoneOtpWidget } from '@dealers-drive/contracts';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { StatusTag } from '@/components/ui/primitives';
import { verifyPhoneAction } from '@/features/auth/phone-actions';
import { loadMsg91Widget, retryMsg91Otp, sendMsg91Otp, verifyMsg91Otp } from '@/lib/msg91-widget';

/**
 * DESIGN-SPEC §3.10 — step 1's mobile check, in its four states (**R39**).
 *
 * ── What this component decides, and what it does not ───────────────────────
 * It runs MSG91's widget in the browser: `sendOtp` puts a code on the dealer's
 * handset and `verifyOtp` hands back a signed access token. It then posts that
 * token to the API and **believes the API's answer and nothing else**. A page
 * that could decide for itself that a number was verified is a page that can be
 * told to; the only thing that can settle the question is a call carrying
 * `MSG91_AUTH_KEY`, and that key is never in a browser.
 *
 * So `verified` is a prop, not state. It is the wizard's reading of the
 * *session* — "is the number currently in the box the one this account
 * proved?" — which means editing the box drops the panel out of its success
 * state for free, with no reconciliation to get wrong, and a reload shows the
 * truth rather than what this component last remembered.
 *
 * ── The four states ─────────────────────────────────────────────────────────
 *   idle      the number is being typed; the step's forward action is Send OTP
 *   code      a code is out; six boxes, a resend countdown, verify or cancel
 *   failed    the same panel in `err`, with what is left of the local attempts
 *   verified  the number is settled, and the forward action is Continue
 *
 * The failure state's attempt count is a **guard rail, not the limit**. The
 * real limits are the API's — ten presentations in ten minutes — and MSG91's
 * own per-number sending cap. Three wrong codes almost always means the dealer
 * is reading an older SMS, so this stops and asks for a fresh one rather than
 * letting them spend the server's allowance proving it.
 *
 * ── Why the step's forward button lives here ────────────────────────────────
 * The design puts Send OTP, Verify & continue and Continue to business details
 * in three places across three states of one step. A footer owned by the wizard
 * would have to mirror this component's stage to know which to draw, and two
 * copies of one state machine is exactly the bug that produces a dead Continue
 * button. Step 1's action bar is therefore part of this panel, and the wizard
 * draws its own only from step 2 on.
 */
export type PhoneStage = 'idle' | 'code' | 'failed';

/** How long before a new code may be asked for. The design's countdown runs from here. */
const RESEND_SECONDS = 30;

/** Wrong codes accepted before a fresh one is required. See the note above. */
const LOCAL_ATTEMPTS = 3;

const WRONG_CODE = 'That code is not right. Check the SMS, or ask for a new one.';

export interface PhoneVerificationProps {
  /** `GET /v1/auth/phone/widget`, or null when the API could not be reached. */
  widget: PhoneOtpWidget | null;
  /** The ten digits currently in the phone box. Owned by the wizard. */
  phone: string;
  /** Shown on the success panel — "…has been linked to R. Manikandan". */
  fullName: string;
  /** The session's answer: is `phone` the number this account proved? */
  verified: boolean;
  /** Called once the API has recorded the number, with it in E.164. */
  onVerified: (phone: string) => void;
  /** The step's forward move, from the success panel. */
  onContinue: () => void;
  /**
   * The wizard's own check on the fields above — a name, a well-formed number
   * — run before a message is sent. Returning false stops the send: an SMS
   * costs money, and a dealer who has mistyped their number would be paying for
   * it to arrive somewhere else.
   */
  onBeforeSend: (form: HTMLFormElement | null) => boolean;
  /**
   * Where the panel opens. `idle` in the product, always — this exists so the
   * sandbox can render the states that are otherwise only reachable by sending
   * a real message.
   */
  initialStage?: PhoneStage;
}

export function PhoneVerification({
  widget,
  phone,
  fullName,
  verified,
  onVerified,
  onContinue,
  onBeforeSend,
  initialStage = 'idle',
}: PhoneVerificationProps) {
  const captchaId = useId();
  const [stage, setStage] = useState<PhoneStage>(initialStage);
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<string | null>(
    initialStage === 'failed' ? WRONG_CODE : null,
  );
  const [attemptsLeft, setAttemptsLeft] = useState(
    initialStage === 'failed' ? LOCAL_ATTEMPTS - 1 : LOCAL_ATTEMPTS,
  );
  /**
   * When a new code may be asked for.
   *
   * Seeded when the panel *opens* on a code rather than arriving at one, which
   * only the sandbox does: a story showing the code panel without its countdown
   * would be showing a state the product never renders.
   */
  const [resendAt, setResendAt] = useState(() =>
    initialStage === 'idle' ? 0 : Date.now() + RESEND_SECONDS * 1000,
  );
  const [remaining, setRemaining] = useState(0);
  const [pending, startTransition] = useTransition();

  /**
   * Guards the window between a click and the render that disables the button.
   *
   * `pending` arrives a paint later, and a double-click inside that paint is
   * two SMS on a provider we cannot rate-limit from here.
   */
  const busy = useRef(false);

  useEffect(() => {
    const tick = (): void => {
      setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [resendAt]);

  const enabled = widget?.enabled ?? false;
  const display = formatPhone(phone);

  /**
   * Put a code on the handset.
   *
   * Under the `fake` driver nothing is sent and no script is loaded — the panel
   * opens and says which digits it will accept. That is not a stub of this
   * flow: every refusal below, the server action, the API call and the binding
   * check underneath all run unchanged. Only the provider is replaced.
   */
  async function send(form: HTMLFormElement | null, resend: boolean): Promise<void> {
    if (busy.current || !enabled || !widget) return;
    if (!resend && !onBeforeSend(form)) return;
    if (resend && remaining > 0) return;

    busy.current = true;
    setFailure(null);
    try {
      if (widget.driver === 'msg91') {
        await loadMsg91Widget({
          widgetId: widget.widgetId ?? '',
          tokenAuth: widget.tokenAuth ?? '',
          captchaRenderId: captchaId,
        });
        // MSG91 wants `919840012345` — country code included, no `+`.
        if (resend) await retryMsg91Otp();
        else await sendMsg91Otp(identifierOf(phone));
      }

      setCode('');
      setAttemptsLeft(LOCAL_ATTEMPTS);
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setStage('code');
    } catch (error) {
      /*
       * The reason, when there is one worth showing.
       *
       * This used to be a bare `catch {}` under one fixed sentence, which is
       * the wrong trade for a provider integration: "check it and try again"
       * is useless advice when the actual problem is that the script is
       * blocked or the domain is not allow-listed, and the person who can fix
       * that is the one reading this screen. The full error object goes to the
       * console either way — see `lib/msg91-widget.ts`.
       */
      setFailure(
        error instanceof Error && error.message.startsWith('The verification service')
          ? error.message
          : 'We could not send a code to that number. Check it and try again.',
      );
      setStage(resend ? 'failed' : 'idle');
    } finally {
      busy.current = false;
    }
  }

  /** Hand the token to the API, which is the only party that can judge it. */
  async function verify(entered: string): Promise<void> {
    if (busy.current || entered.length < 6 || !widget) return;
    busy.current = true;
    setFailure(null);

    try {
      const accessToken =
        widget.driver === 'msg91'
          ? await verifyMsg91Otp(entered)
          : /*
             * The documented development shape — see
             * `platform/phone-otp/fake.adapter.ts`. It names the number because
             * there is no provider here to name it, and the server still checks
             * the two against each other rather than taking the claim on trust.
             */
            /*
             * The trailing nonce is what the server's replay guard needs: it
             * remembers a token for fifteen minutes, and without one a second
             * attempt at the same number in one sitting would be refused as a
             * reuse rather than judged on the code.
             */
            `dev-otp:${identifierOf(phone)}:${entered}:${String(Date.now())}`;

      const result = await verifyPhoneAction(phone, accessToken);

      if (!result.verified) {
        refuse(result.error ?? WRONG_CODE);
        return;
      }

      setStage('idle');
      setCode('');
      onVerified(result.phone ?? phone);
    } catch (error) {
      // The widget refused the code itself and never minted a token, so the API
      // was not reached. A wrong code is the overwhelmingly likely reason and
      // reads as one; anything the widget itself reports is shown instead,
      // because that is a problem the dealer cannot solve by retyping.
      refuse(
        error instanceof Error && error.message.startsWith('The verification service')
          ? error.message
          : WRONG_CODE,
      );
    } finally {
      busy.current = false;
    }
  }

  function refuse(message: string): void {
    setAttemptsLeft((left) => Math.max(0, left - 1));
    setFailure(message);
    setStage('failed');
  }

  function reset(): void {
    setStage('idle');
    setFailure(null);
    setCode('');
  }

  /* ── unavailable ────────────────────────────────────────────────────────── */
  if (!enabled) {
    return (
      <section
        role="status"
        className="border border-[color-mix(in_srgb,#a15c00_30%,transparent)] bg-(--color-warn-bg) px-[16px] py-[14px] text-[13px]"
      >
        <p className="font-semibold text-(--color-warn)">Mobile verification is unavailable</p>
        <p className="mt-[4px] ink-body">
          {widget?.reason ?? 'We could not reach the verification service.'} Your dealership cannot
          be set up until this number is confirmed — please try again in a few minutes.
        </p>
      </section>
    );
  }

  /* ── verified ───────────────────────────────────────────────────────────── */
  if (verified) {
    return (
      <section
        aria-live="polite"
        className="border border-[color-mix(in_srgb,#0f7a5a_30%,transparent)] bg-(--color-ok-bg) px-[18px] py-[16px]"
      >
        <div className="flex flex-wrap items-center gap-[12px]">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-(--color-ok)">Mobile number verified</h2>
            <p className="mt-[2px] text-[13px] ink-body">
              <span className="tnum font-medium">{display}</span> has been linked to{' '}
              <span className="font-medium">{fullName.trim() || 'your account'}</span>.
            </p>
          </div>
          <StatusTag tone="ok">Verified</StatusTag>
        </div>

        <div className="mt-[16px] flex flex-wrap items-center justify-between gap-[10px] border-t border-[color-mix(in_srgb,#0f7a5a_30%,transparent)] pt-[14px]">
          <span className="text-[12px] ink-secondary">Next: your dealership’s details</span>
          <Button variant="primary" size="md" onClick={onContinue}>
            Continue to business details
          </Button>
        </div>
      </section>
    );
  }

  /* ── idle ───────────────────────────────────────────────────────────────── */
  if (stage === 'idle') {
    return (
      <>
        <Captcha id={captchaId} />
        {failure ? (
          <p role="alert" className="mb-[10px] text-[12px] text-(--color-err)">
            {failure}
          </p>
        ) : null}
        <Button
          variant="primary"
          size="md"
          block
          loading={pending}
          onClick={(event) => {
            const form = event.currentTarget.form;
            startTransition(async () => {
              await send(form, false);
            });
          }}
        >
          Send OTP
        </Button>
      </>
    );
  }

  /* ── code · failed ──────────────────────────────────────────────────────── */
  const failed = stage === 'failed';
  const exhausted = attemptsLeft <= 0;

  return (
    <section
      className={
        failed
          ? 'border border-[color-mix(in_srgb,#b3261e_30%,transparent)] bg-(--color-err-bg) px-[18px] py-[16px]'
          : 'border border-(--color-accent) bg-(--color-accent-100) px-[18px] py-[16px]'
      }
      /*
       * Enter inside these boxes submits the code, and — more to the point —
       * must not submit the wizard's form. Steps 1 and 2 share one `<form>`
       * whose submit creates the dealership, and implicit submission from a
       * field on step 1 would post a half-filled step 2.
       */
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (code.length === 6 && !exhausted) {
          startTransition(async () => {
            await verify(code);
          });
        }
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-[8px]">
        <div className="min-w-0">
          <h2
            className={`text-[15px] font-semibold ${failed ? 'text-(--color-err)' : 'text-(--color-accent-800)'}`}
          >
            {failed ? 'That code did not match' : 'Verify your mobile number'}
          </h2>
          <p className="mt-[2px] text-[13px] ink-body" aria-live="polite">
            {failed ? (
              <>
                {failure}{' '}
                {exhausted ? (
                  <strong>Ask for a new code to try again.</strong>
                ) : (
                  <>
                    <strong className="tnum">{attemptsLeft}</strong>{' '}
                    {attemptsLeft === 1 ? 'attempt' : 'attempts'} left before you need a new one.
                  </>
                )}
              </>
            ) : widget?.driver === 'fake' ? (
              <>
                No SMS is sent in this environment — enter{' '}
                <strong className="tnum">{widget.devCode}</strong>.
              </>
            ) : (
              <>
                We sent a 6-digit code to <span className="tnum font-medium">{display}</span>.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className="text-[12px] font-semibold text-(--color-accent) underline"
          onClick={reset}
        >
          Change number
        </button>
      </div>

      <div className="my-[16px]">
        <OtpInput
          id="otp"
          value={code}
          onChange={(next) => {
            setCode(next);
            // Typing over a rejected code returns the panel to its ordinary
            // state; leaving it red while the dealer corrects it reads as if
            // the new digits were wrong too.
            if (failed && next.length < 6) setStage('code');
          }}
          invalid={failed}
          disabled={pending || exhausted}
          autoFocus
          label="6-digit verification code"
        />
      </div>

      <Captcha id={captchaId} />

      <div className="flex flex-wrap items-center justify-between gap-[8px] text-[12px]">
        <span className="tnum ink-secondary">
          {remaining > 0 ? `You can ask for a new code in ${countdown(remaining)}` : ''}
        </span>
        <button
          type="button"
          className="font-semibold text-(--color-accent) underline disabled:no-underline disabled:opacity-45"
          disabled={pending || remaining > 0}
          onClick={() => {
            startTransition(async () => {
              await send(null, true);
            });
          }}
        >
          Resend code
        </button>
      </div>

      <div className="mt-[16px] flex flex-wrap gap-[8px]">
        <Button
          variant="primary"
          size="md"
          loading={pending}
          disabled={code.length < 6 || exhausted}
          onClick={() => {
            startTransition(async () => {
              await verify(code);
            });
          }}
        >
          Verify &amp; continue
        </Button>
        <Button variant="secondary" size="md" onClick={reset}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

/** `9840012345` → `919840012345`, which is the identifier shape MSG91 uses. */
function identifierOf(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('91') && digits.length > 10 ? digits : `91${digits}`;
}

/**
 * Where MSG91 renders its captcha when it decides one is needed.
 *
 * The element has to exist *before* `initSendOTP` runs — `captchaRenderId` is
 * looked up by id — so it is rendered unconditionally rather than in response
 * to a challenge that has already been missed. `empty:hidden` keeps it out of
 * the layout until the widget puts something in it.
 */
function Captcha({ id }: { id: string }) {
  return <div id={id} className="mb-[12px] empty:hidden" />;
}

function countdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
