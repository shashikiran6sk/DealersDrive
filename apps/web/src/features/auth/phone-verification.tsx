'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusTag } from '@/components/ui/primitives';
import {
  startPhoneVerificationAction,
  verifyPhoneAction,
  type PhoneState,
} from '@/features/auth/phone-actions';

/** Onboarding phone ownership. All SMS calls go through authenticated server actions. */
type Stage = 'number' | 'code' | 'verified';

export interface PhoneVerificationProps {
  /** False when the API configuration could not be loaded. */
  phoneVerificationEnabled?: boolean;
  /** What the session already holds, so a returning dealer is not asked again. */
  initialPhone?: string;
  initialPhoneDisplay?: string;
  verified: boolean;
  /**
   * The wizard's own refusal, when Continue is pressed on an unverified number.
   *
   * It arrives as a prop rather than being raised here because the *step*
   * decides when to complain, not the field: the dealer has not done anything
   * wrong until they try to leave. The component's own `fieldError` — a number
   * another dealership holds, say — takes precedence, because it is the more
   * specific of the two and is about the value in front of them.
   */
  error?: string;
}

export function PhoneVerification({
  phoneVerificationEnabled = true,
  initialPhone = '',
  initialPhoneDisplay = '',
  verified,
  error,
}: PhoneVerificationProps) {
  const [stage, setStage] = useState<Stage>(verified ? 'verified' : 'number');
  // `+91` off, because the box asks for the ten digits the label's hint shows.
  const [typed, setTyped] = useState(initialPhone.replace(/^\+91/, ''));
  const [display, setDisplay] = useState(initialPhoneDisplay);
  const [e164, setE164] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [state, setState] = useState<PhoneState>({});
  const [pending, startTransition] = useTransition();

  const [challengeId, setChallengeId] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  // A ref closes the gap before React renders the pending button state.
  const busy = useRef(false);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  /** A form's own hidden input, so the wizard can require verification. */
  const hidden = (
    <input type="hidden" name="phoneVerified" value={stage === 'verified' ? 'true' : ''} />
  );

  if (stage === 'verified') {
    return (
      /*
       * `id="phone"`, matching the unverified branch — and **not**
       * `phoneVerified`, which is the name of the hidden flag below.
       * `form.elements.namedItem()` matches on `id` *and* `name`, so an
       * element carrying one as its id and another carrying it as its name
       * makes the lookup return a `RadioNodeList` instead of the input. The
       * wizard's step-1 gate reads that flag through exactly that call, and the
       * symptom was a verified dealer who could not press Continue.
       */
      <Field id="phone" label="Mobile" error={state.fieldError ?? error}>
        <div className="flex flex-wrap items-center gap-[10px]">
          {/*
            A real `<input>`, disabled and without a `name`, rather than a
            `<span>`. A span cannot be labelled — `<label for>` needs a
            labelable element — so the field would announce as nothing to a
            screen reader, and this is the row that says whose number a buyer
            will ring. It is the `LockedField` shape from the profile screen,
            for the same reason and with the same two properties: disabled
            controls are not submitted, and one with no name has nothing to be
            submitted under.
          */}
          <input
            id="phone"
            className="input tnum w-auto"
            value={display || initialPhoneDisplay}
            disabled
            readOnly
          />
          <StatusTag tone="ok">Verified</StatusTag>
          {/*
            The way back is a button rather than an editable box. Changing the
            number is not an edit — it is a new claim about a different handset,
            and it has to go through an OTP like the first one did.
          */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStage('number');
              setState({});
              setCode('');
            }}
          >
            Change
          </Button>
        </div>
        {hidden}
      </Field>
    );
  }

  async function sendCode(): Promise<void> {
    if (busy.current || Date.now() < resendAt || !phoneVerificationEnabled) return;
    busy.current = true;
    setState({});
    try {
      const started = await startPhoneVerificationAction(typed);
      if (!started.phone || !started.challengeId) {
        setState(started);
        return;
      }
      setChallengeId(started.challengeId);
      setE164(started.phone);
      setDisplay(started.phoneDisplay ?? started.phone);
      setResendAt(Date.now() + (started.resendAfterSeconds ?? 60) * 1000);
      setCode('');
      setStage('code');
    } catch {
      setState({ error: 'The API is unavailable. Try again shortly.' });
    } finally {
      busy.current = false;
    }
  }

  async function confirmCode(): Promise<void> {
    if (busy.current || !challengeId) return;
    busy.current = true;
    setState({});
    try {
      const result = await verifyPhoneAction(challengeId, code);
      if (!result.verified) {
        setState(result);
        return;
      }
      setDisplay(result.phoneDisplay ?? display);
      setStage('verified');
    } catch {
      setState({ error: 'The API is unavailable. Try again shortly.' });
    } finally {
      busy.current = false;
    }
  }

  return (
    <Field
      id="phone"
      label="Mobile"
      hint={stage === 'code' ? `code sent to ${display}` : '+91'}
      error={state.fieldError ?? error}
    >
      {stage === 'number' ? (
        <div className="flex items-start gap-[8px]">
          <Input
            id="phone"
            className="tnum"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98400 12345"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value);
            }}
            required
            aria-required="true"
            aria-invalid={(state.fieldError ?? error) ? true : undefined}
          />
          <Button
            variant="secondary"
            className="h-[38px] flex-none"
            loading={pending}
            disabled={
              pending || !phoneVerificationEnabled || remaining > 0 || typed.trim().length === 0
            }
            onClick={() => {
              startTransition(async () => {
                await sendCode();
              });
            }}
          >
            {remaining > 0 ? `Send in ${remaining}s` : 'Send code'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-[8px]">
          <div className="flex items-start gap-[8px]">
            <Input
              id="phone"
              className="tnum"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              maxLength={6}
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, ''));
              }}
            />
            <Button
              variant="primary"
              className="h-[38px] flex-none"
              loading={pending}
              disabled={code.length < 6}
              onClick={() => {
                startTransition(async () => {
                  await confirmCode();
                });
              }}
            >
              Verify
            </Button>
          </div>
          <div className="flex gap-[12px] text-[11px]">
            <button
              type="button"
              className="ink-secondary underline"
              disabled={pending}
              onClick={() => {
                setStage('number');
                setState({});
                setCode('');
              }}
            >
              Change number
            </button>
            <button
              type="button"
              className="ink-secondary underline"
              disabled={pending || remaining > 0}
              onClick={() => {
                startTransition(async () => {
                  await sendCode();
                });
              }}
            >
              {remaining > 0 ? `Resend in ${remaining}s` : 'Send it again'}
            </button>
          </div>
        </div>
      )}

      {state.error ? (
        <p role="alert" className="mt-[6px] text-[11px] text-(--color-err)">
          {state.error}
        </p>
      ) : null}

      {!phoneVerificationEnabled ? (
        <p role="status" className="mt-[6px] text-[11px] ink-subtle">
          Phone verification is temporarily unavailable. Please try again shortly.
        </p>
      ) : null}

      <input type="hidden" name="phone" value={e164} />
      {hidden}
    </Field>
  );
}
