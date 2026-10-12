'use client';

import {
  DEALER_VERIFICATION_LABELS,
  type DealerVerificationReview,
  type DealerVerificationStatus,
} from '@dealers-drive/contracts';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/input';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { decideDealerVerification } from '@/features/admin/dealer-verification/actions';
import {
  DATE_LOCALE,
  DEALER_VERIFICATION_TEXT,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  REASON_REQUIRED_STATUSES,
} from './dealer-verification.constants';
import { VerificationHistory } from './verification-history';

function needsReason(status: DealerVerificationStatus): boolean {
  return REASON_REQUIRED_STATUSES.some((required) => required === status);
}

export function DealerVerificationReviewPanel({ initial }: { initial: DealerVerificationReview }) {
  const [saved, setSaved] = useState<DealerVerificationReview | null>(null);
  const review =
    saved && saved.dealerId === initial.dealerId && saved.version > initial.version
      ? saved
      : initial;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useNavigationSafeAction();
  const [target, setTarget] = useState(review.transitions[0] ?? 'REVOKED');
  const choice = review.transitions.includes(target)
    ? target
    : (review.transitions[0] ?? 'REVOKED');

  return (
    <section className="card gap-4 p-4" aria-labelledby="dealer-verification-heading">
      <div>
        <h2 id="dealer-verification-heading" className="text-[19px]">
          {DEALER_VERIFICATION_TEXT.heading}
        </h2>
        <p className="font-bold">{review.statusLabel}</p>
        <p className="text-[13px] ink-muted">{DEALER_VERIFICATION_TEXT.intro}</p>
      </div>
      {review.verifiedAt ? (
        <p className="text-[13px]">
          {DEALER_VERIFICATION_TEXT.verifiedOn(
            new Date(review.verifiedAt).toLocaleDateString(DATE_LOCALE),
          )}
        </p>
      ) : null}
      {review.transitions.length > 0 ? (
        <form
          key={`${review.dealerId}:${review.version}`}
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (pending) return;
            setError(null);
            const reason = new FormData(event.currentTarget).get('reason');
            start(async () => {
              const result = await decideDealerVerification(review.dealerId, {
                expectedVersion: review.version,
                status: choice,
                ...(reason ? { reason } : {}),
              });
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setSaved(result.review);
              setTarget(result.review.transitions[0] ?? 'REVOKED');
            });
          }}
        >
          <label className="text-[13px] font-bold">
            {DEALER_VERIFICATION_TEXT.nextStatus}
            <Select
              value={choice}
              onChange={(event) => {
                const found = review.transitions.find((status) => status === event.target.value);
                if (found) setTarget(found);
              }}
            >
              {review.transitions.map((status) => (
                <option key={status} value={status}>
                  {DEALER_VERIFICATION_LABELS[status]}
                </option>
              ))}
            </Select>
          </label>
          {needsReason(choice) ? (
            <label className="text-[13px] font-bold">
              {DEALER_VERIFICATION_TEXT.reason}
              <Textarea
                name="reason"
                required
                minLength={REASON_MIN_LENGTH}
                maxLength={REASON_MAX_LENGTH}
                rows={3}
              />
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="text-[13px] text-(--color-err)">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={pending} disabled={pending} className="self-start">
            {DEALER_VERIFICATION_TEXT.save}
          </Button>
        </form>
      ) : null}
      <VerificationHistory history={review.history} />
    </section>
  );
}
