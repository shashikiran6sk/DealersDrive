'use client';

import { ASSISTED_EMAIL_CODE_LENGTH, SalesEmailCodeInput } from '@dealers-drive/contracts';
import { useEffect, useId, useState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendDealerEmailCodeAction, verifyDealerEmailAction } from '@/features/sales/sales-actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { EmailCodePanel } from './email-code-panel';
import { EmailCodeVerified } from './email-code-verified';
import { EMAIL_CODE_TEXT, EMAIL_RESEND_SECONDS } from './email-code-verification.constants';
import type { EmailCodeStage, EmailCodeVerificationProps } from './email-code-verification.types';

export function EmailCodeVerification({
  onVerified,
  initialEmail = '',
  disabled = false,
  initialStage = 'email',
}: EmailCodeVerificationProps) {
  const id = useId();
  const emailId = `${id}-email`;
  const [pending, startTransition] = useNavigationSafeAction();
  const [email, setEmail] = useState(initialEmail);
  const [stage, setStage] = useState<EmailCodeStage>(initialStage);
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(
    initialStage === 'failed' ? EMAIL_CODE_TEXT.wrongCode : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(() =>
    initialStage === 'code' || initialStage === 'failed'
      ? Date.now() + EMAIL_RESEND_SECONDS * 1000
      : 0,
  );
  const [remaining, setRemaining] = useState(0);

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

  function send(resend: boolean): void {
    if (pending || disabled) return;
    const parsed = SalesEmailCodeInput.safeParse({ email });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? EMAIL_CODE_TEXT.emailInvalid);
      return;
    }
    setMessage(null);
    setNotice(null);
    startTransition(async () => {
      const result = await sendDealerEmailCodeAction(parsed.data.email);
      if (!result.ok || !result.challenge) {
        setMessage(result.message ?? EMAIL_CODE_TEXT.emailInvalid);
        return;
      }
      setEmail(result.email ?? parsed.data.email);
      setChallenge(result.challenge);
      setCode('');
      setResendAt(Date.now() + (result.resendAfterSeconds ?? EMAIL_RESEND_SECONDS) * 1000);
      setStage('code');
      if (resend) setNotice(EMAIL_CODE_TEXT.resent);
    });
  }

  function verify(): void {
    if (pending || disabled || code.length < ASSISTED_EMAIL_CODE_LENGTH) return;
    setMessage(null);
    setNotice(null);
    startTransition(async () => {
      const result = await verifyDealerEmailAction(challenge, code);
      if (!result.ok || !result.emailTicket) {
        setStage('failed');
        setMessage(result.message ?? EMAIL_CODE_TEXT.wrongCode);
        return;
      }
      const verified = result.email ?? email;
      setEmail(verified);
      setStage('verified');
      onVerified({ email: verified, emailTicket: result.emailTicket });
    });
  }

  const fieldError = stage === 'email' ? (message ?? undefined) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <Field
        id={emailId}
        label={EMAIL_CODE_TEXT.emailLabel}
        hint={EMAIL_CODE_TEXT.emailHint}
        error={fieldError}
      >
        <Input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder={EMAIL_CODE_TEXT.emailPlaceholder}
          value={email}
          readOnly={stage !== 'email'}
          disabled={disabled}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || stage !== 'email') return;
            event.preventDefault();
            send(false);
          }}
          {...invalidProps(emailId, fieldError)}
        />
      </Field>

      {stage === 'email' ? (
        <div>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={pending}
            disabled={disabled}
            onClick={() => send(false)}
          >
            {EMAIL_CODE_TEXT.send}
          </Button>
        </div>
      ) : null}

      {stage === 'code' || stage === 'failed' ? (
        <EmailCodePanel
          codeId={`${id}-code`}
          email={email}
          code={code}
          onCodeChange={(next) => {
            setCode(next);
            if (stage === 'failed' && next.length < ASSISTED_EMAIL_CODE_LENGTH) {
              setStage('code');
              setMessage(null);
            }
          }}
          failed={stage === 'failed'}
          message={message}
          notice={notice}
          remaining={remaining}
          pending={pending}
          disabled={disabled}
          onVerify={verify}
          onResend={() => send(true)}
          onChangeEmail={() => {
            setStage('email');
            setCode('');
            setMessage(null);
            setNotice(null);
          }}
        />
      ) : null}

      {stage === 'verified' ? <EmailCodeVerified email={email} /> : null}
    </div>
  );
}
