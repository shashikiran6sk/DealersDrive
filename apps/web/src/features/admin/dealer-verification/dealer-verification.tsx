'use client';

import { useState } from 'react';
import {
  DEALER_VERIFICATION_LABELS,
  type DealerVerificationReview,
} from '@dealers-drive/contracts';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/input';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';
import { decideDealerVerification } from './actions';

const CHECKS = [
  ['representativeIdentity', 'Representative identity evidence'],
  ['representativeAuthority', 'Authority to represent the business'],
  ['businessExistence', 'Business existence evidence'],
  ['contactValidation', 'Contact validation evidence'],
  ['classificationEvidence', 'Business classification and legal review reference'],
  ['regulatoryEvidence', 'Applicable authorization check or reviewed non-applicability'],
  ['gstEvidence', 'GST registration check or reviewed non-requirement'],
] as const;

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
          Dealer verification
        </h2>
        <p className="font-bold">{review.statusLabel}</p>
        <p className="text-[13px] ink-muted">
          Review the business and its authorized representative. Yard ownership and photos are
          optional. Approval, physical location checks and vehicle inspection are separate.
        </p>
      </div>
      {review.verifiedAt ? (
        <p className="text-[13px]">
          Verified {new Date(review.verifiedAt).toLocaleDateString('en-IN')} · Reviewer{' '}
          {review.reviewerId}
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
            const data = new FormData(event.currentTarget);
            const assessment = Object.fromEntries(CHECKS.map(([key]) => [key, data.get(key)]));
            start(async () => {
              const result = await decideDealerVerification(review.dealerId, {
                expectedVersion: review.version,
                status: choice,
                ...(data.get('reason') ? { reason: data.get('reason') } : {}),
                ...(choice === 'VERIFIED'
                  ? {
                      assessment: {
                        ...assessment,
                        businessType: data.get('businessType'),
                        regulatoryOutcome: data.get('regulatoryOutcome'),
                        gstOutcome: data.get('gstOutcome'),
                      },
                    }
                  : {}),
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
            Next verification status
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
          {choice === 'VERIFIED' ? (
            <fieldset disabled={pending} className="flex min-w-0 flex-col gap-3">
              <legend className="mb-2 text-[13px] font-bold">
                Record checks actually performed
              </legend>
              <p className="text-[12px] ink-muted">
                Use protected document or case references. Do not paste PAN, Aadhaar, OTPs or
                private document URLs. Unresolved legal applicability must remain in review.
              </p>
              <label className="text-[13px] font-bold">
                Reviewed business classification
                <Select name="businessType" defaultValue="REGISTERED_VEHICLE_DEALER">
                  <option value="REGISTERED_VEHICLE_DEALER">Dealer of registered vehicles</option>
                  <option value="INTERMEDIARY_REVIEWED">
                    Intermediary — classification reviewed
                  </option>
                </Select>
              </label>
              {CHECKS.map(([key, label]) => (
                <label key={key} className="text-[13px] font-bold">
                  {label}
                  <Textarea name={key} required minLength={20} maxLength={2000} rows={2} />
                </label>
              ))}
              <label className="text-[13px] font-bold">
                Regulatory authorization outcome
                <Select name="regulatoryOutcome" required defaultValue="">
                  <option value="" disabled>
                    Select a reviewed outcome
                  </option>
                  <option value="CHECKED_VALID">Applicable authorization checked valid</option>
                  <option value="NOT_APPLICABLE_REVIEWED">
                    Not applicable — legal classification reviewed
                  </option>
                </Select>
              </label>
              <label className="text-[13px] font-bold">
                GST applicability outcome
                <Select name="gstOutcome" required defaultValue="">
                  <option value="" disabled>
                    Select a reviewed outcome
                  </option>
                  <option value="CHECKED_VALID">Applicable registration checked valid</option>
                  <option value="NOT_REQUIRED_REVIEWED">
                    Registration not required — reviewed
                  </option>
                </Select>
              </label>
            </fieldset>
          ) : null}
          {choice === 'REJECTED' || choice === 'REVOKED' ? (
            <label className="text-[13px] font-bold">
              Decision reason
              <Textarea name="reason" required minLength={10} maxLength={2000} rows={3} />
            </label>
          ) : null}
          {error ? (
            <p role="alert" className="text-[13px] text-(--color-err)">
              {error}
            </p>
          ) : null}
          <Button type="submit" loading={pending} disabled={pending} className="self-start">
            Save verification decision
          </Button>
        </form>
      ) : null}
      <div>
        <h3 className="text-[16px]">Verification history</h3>
        <p className="text-[12px] ink-muted">
          Latest 100 decisions. Full history is retained in the restricted audit log.
        </p>
        {review.history.length === 0 ? (
          <p className="text-[13px] ink-muted">No verification decisions recorded.</p>
        ) : (
          <ol className="flex list-none flex-col gap-3 p-0">
            {review.history.map((event) => (
              <li
                key={event.id}
                className="border-t border-(--color-divider) pt-3 text-[13px] [overflow-wrap:anywhere]"
              >
                <p>
                  {DEALER_VERIFICATION_LABELS[event.from]} → {DEALER_VERIFICATION_LABELS[event.to]}
                </p>
                <p className="ink-muted">
                  {new Date(event.at).toLocaleString('en-IN')} · Administrator{' '}
                  {event.actorId ?? 'System'}
                </p>
                {event.reason ? <p>{event.reason}</p> : null}
                {event.assessment ? (
                  <details>
                    <summary>Reviewed evidence references</summary>
                    <dl>
                      {Object.entries(event.assessment).map(([key, value]) => (
                        <div key={key}>
                          <dt className="font-bold">
                            {CHECKS.find(([field]) => field === key)?.[1] ?? key}
                          </dt>
                          <dd className="m-0">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
