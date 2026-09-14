'use client';

import { formatPhone } from '@dealers-drive/contracts';
import { useEffect, useId, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { checkPhoneAvailabilityAction, verifyPhoneAction } from '@/features/auth/phone-actions';
import { loadMsg91Widget, retryMsg91Otp, sendMsg91Otp, verifyMsg91Otp } from '@/lib/msg91-widget';

import { Captcha } from './captcha';
import { PhoneCodePanel } from './phone-code-panel';
import { PhoneUnavailable } from './phone-unavailable';
import { PhoneVerified } from './phone-verified';
import {
  LOCAL_ATTEMPTS,
  OTP_DIGITS,
  PHONE_TEXT,
  RESEND_SECONDS,
} from './phone-verification.constants';
import type { PhoneStage, PhoneVerificationProps } from './phone-verification.types';
import { identifierOf, isServiceFailure } from './utils';

/**
 * DESIGN-SPEC §3.10 — step 1's mobile check, in its four states (**R39**).
 *
 * It runs MSG91's widget in the browser: `sendOtp` puts a code on the dealer's
 * handset and `verifyOtp` hands back a signed access token. It then posts that
 * token to the API and **believes the API's answer and nothing else**. A page
 * that could decide for itself that a number was verified is a page that can be
 * told to; the only thing that can settle the question is a call carrying
 * `MSG91_AUTH_KEY`, and that key is never in a browser.
 *
 * So `verified` is a prop, not state — the wizard's reading of the *session*,
 * which means editing the box drops the panel out of its success state for free
 * and a reload shows the truth rather than what this component last remembered.
 *
 * The four states: **idle** (Send OTP), **code** (six boxes and a countdown),
 * **failed** (the same panel in `err`, with the local attempts left) and
 * **verified** (Continue).
 *
 * **The step's forward button lives here** because the design puts Send OTP,
 * Verify & continue and Continue to business details in three places across
 * three states of one step. A footer owned by the wizard would have to mirror
 * this component's stage, and two copies of one state machine is exactly the bug
 * that produces a dead Continue button.
 */
export function PhoneVerification({
  widget,
  phone,
  fullName,
  verified,
  onVerified,
  onContinue,
  onBeforeSend,
  onRefused,
  initialStage = 'idle',
}: PhoneVerificationProps) {
  const captchaId = useId();
  const [stage, setStage] = useState<PhoneStage>(initialStage);
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<string | null>(
    initialStage === 'failed' ? PHONE_TEXT.wrongCode : null,
  );
  const [attemptsLeft, setAttemptsLeft] = useState(
    initialStage === 'failed' ? LOCAL_ATTEMPTS - 1 : LOCAL_ATTEMPTS,
  );
  /**
   * When a new code may be asked for. Seeded when the panel *opens* on a code
   * rather than arriving at one, which only the sandbox does: a story showing the
   * code panel without its countdown would be showing a state the product never
   * renders.
   */
  const [resendAt, setResendAt] = useState(() =>
    initialStage === 'idle' ? 0 : Date.now() + RESEND_SECONDS * 1000,
  );
  const [remaining, setRemaining] = useState(0);
  const [pending, startTransition] = useTransition();

  /**
   * Guards the window between a click and the render that disables the button.
   * `pending` arrives a paint later, and a double-click inside that paint is two
   * SMS on a provider we cannot rate-limit from here.
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
   * opens and says which digits it will accept. That is not a stub of this flow:
   * every refusal below, the server action, the API call and the binding check
   * underneath all run unchanged. Only the provider is replaced.
   */
  async function send(form: HTMLFormElement | null, resend: boolean): Promise<void> {
    if (busy.current || !enabled || !widget) return;
    if (!resend && !onBeforeSend(form)) return;
    if (resend && remaining > 0) return;

    busy.current = true;
    setFailure(null);
    try {
      /*
       * Three questions, in this order, and only the third costs anything.
       * `onBeforeSend` asked whether it is a number. This asks whether it is
       * *free* — before the widget sends, because the widget sends from the
       * browser and the API cannot refuse a message already on its way. It used
       * to be answered by the verification, which meant a dealer who typed a
       * number another dealership holds paid for an SMS, read the code off their
       * own handset, and only then was told they could not have it.
       *
       * Not repeated on a resend: the number has not changed since the check that
       * let the first code out.
       */
      if (!resend) {
        const available = await checkPhoneAvailabilityAction(phone);
        if (available.error) {
          /*
           * One message, not two. This is a refusal about the value in the input,
           * so it belongs under the input — which is what `onRefused` is for. The
           * fallback is for a caller that owns no field to mark, i.e. the sandbox.
           */
          if (onRefused) onRefused(available.error);
          else setFailure(available.error);
          setStage('idle');
          return;
        }
      }

      if (widget.driver === 'msg91') {
        await loadMsg91Widget({
          widgetId: widget.widgetId ?? '',
          tokenAuth: widget.tokenAuth ?? '',
          captchaRenderId: captchaId,
        });
        // MSG91 wants `919840012345` — country code included, no `+`.
        if (resend) await retryMsg91Otp(identifierOf(phone));
        else await sendMsg91Otp(identifierOf(phone));
      }

      setCode('');
      setAttemptsLeft(LOCAL_ATTEMPTS);
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      setStage('code');
    } catch (error) {
      /*
       * The reason, when there is one worth showing. A bare `catch {}` under one
       * fixed sentence is the wrong trade for a provider integration: "check it
       * and try again" is useless advice when the actual problem is that the
       * script is blocked or the domain is not allow-listed, and the person who
       * can fix that is the one reading this screen.
       */
      setFailure(isServiceFailure(error) ? error.message : PHONE_TEXT.sendFailed);
      setStage(resend ? 'failed' : 'idle');
    } finally {
      busy.current = false;
    }
  }

  /** Hand the token to the API, which is the only party that can judge it. */
  async function verify(entered: string): Promise<void> {
    if (busy.current || entered.length < OTP_DIGITS || !widget) return;
    busy.current = true;
    setFailure(null);

    try {
      const accessToken =
        widget.driver === 'msg91'
          ? await verifyMsg91Otp(entered)
          : /*
             * The documented development shape — see
             * `platform/phone-otp/fake.adapter.ts`. The trailing nonce is what the
             * server's replay guard needs: it remembers a token for fifteen
             * minutes, and without one a second attempt at the same number in one
             * sitting would be refused as a reuse rather than judged on the code.
             */
            `dev-otp:${identifierOf(phone)}:${entered}:${String(Date.now())}`;

      const result = await verifyPhoneAction(phone, accessToken);

      if (!result.verified) {
        refuse(result.error ?? PHONE_TEXT.wrongCode);
        return;
      }

      setStage('idle');
      setCode('');
      onVerified(result.phone ?? phone);
    } catch (error) {
      // The widget refused the code itself and never minted a token, so the API
      // was not reached. A wrong code is the overwhelmingly likely reason;
      // anything the widget reports is shown instead, because that is a problem
      // the dealer cannot solve by retyping.
      refuse(isServiceFailure(error) ? error.message : PHONE_TEXT.wrongCode);
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

  // Narrows `widget` for the code panel below: enabled is only ever true with one.
  if (!widget?.enabled) return <PhoneUnavailable reason={widget?.reason ?? undefined} />;

  if (verified) {
    return <PhoneVerified display={display} fullName={fullName} onContinue={onContinue} />;
  }

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
          {PHONE_TEXT.sendOtp}
        </Button>
      </>
    );
  }

  return (
    <PhoneCodePanel
      captchaId={captchaId}
      widget={widget}
      display={display}
      code={code}
      onCodeChange={(next) => {
        setCode(next);
        // Typing over a rejected code returns the panel to its ordinary state;
        // leaving it red while the dealer corrects it reads as if the new digits
        // were wrong too.
        if (stage === 'failed' && next.length < OTP_DIGITS) setStage('code');
      }}
      failed={stage === 'failed'}
      failure={failure}
      attemptsLeft={attemptsLeft}
      remaining={remaining}
      pending={pending}
      onVerify={() => {
        startTransition(async () => {
          await verify(code);
        });
      }}
      onResend={() => {
        startTransition(async () => {
          await send(null, true);
        });
      }}
      onReset={reset}
    />
  );
}
