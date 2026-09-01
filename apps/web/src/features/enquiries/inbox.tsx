'use client';

import type {
  EnquiryCountsResponse,
  EnquiryDto,
  EnquiryListResponse,
  EnquiryStatus,
} from '@dealers-drive/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Avatar, Banner, EmptyState, SkeletonLines, Tag } from '@/components/ui/primitives';
import { updateEnquiryStatusAction } from '@/features/enquiries/actions';

/**
 * DESIGN-SPEC §3.15 — the inbox is a worklist, not a log.
 *
 * ARCHITECTURE §15.1: the counts arrive with the RSC shell, and switching tabs
 * is a client fetch rather than a navigation — so the dealer working through
 * "New" never loses their place in the page.
 */
export function EnquiryInbox({
  initialCounts,
  initialStatus,
  initialData,
}: {
  initialCounts: EnquiryCountsResponse;
  initialStatus: EnquiryStatus;
  initialData: EnquiryListResponse;
}) {
  const [status, setStatus] = useState<EnquiryStatus>(initialStatus);
  const [counts, setCounts] = useState(initialCounts.tabs);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['dealer-enquiries', status],
    queryFn: async (): Promise<EnquiryListResponse> => {
      const response = await fetch(`/api/dealer/enquiries?status=${status}&limit=50`);
      if (!response.ok) throw new Error('Could not load enquiries.');
      return (await response.json()) as EnquiryListResponse;
    },
    ...(status === initialStatus ? { initialData } : {}),
  });

  const update = useMutation({
    mutationFn: async (vars: { id: string; next: EnquiryStatus }) => {
      const result = await updateEnquiryStatusAction(vars.id, { status: vars.next });
      if (!result.ok) throw new Error(result.message ?? 'Update failed.');
      return result;
    },
    onSuccess: (result) => {
      setError(null);
      if (result.counts) {
        // Tab counts come back with the mutation, so they can never drift from
        // the rows the dealer is looking at.
        setCounts((current) =>
          current.map((tab) => ({ ...tab, count: result.counts?.[tab.status] ?? tab.count })),
        );
      }
      void queryClient.invalidateQueries({ queryKey: ['dealer-enquiries'] });
    },
    onError: (cause: Error) => setError(cause.message),
  });

  return (
    <>
      {/* `self-start` so the segmented control hugs its options rather than
          stretching across the column it sits in. */}
      <div className="seg self-start" role="tablist" aria-label="Enquiry status">
        {counts.map((tab) => (
          <button
            key={tab.status}
            type="button"
            role="tab"
            // `.seg-opt` styles the selection off `aria-selected` itself, so
            // the accessible state and the visible state cannot diverge (§2.4).
            aria-selected={tab.status === status}
            className="seg-opt"
            onClick={() => setStatus(tab.status)}
          >
            {/* One text node: `.seg-opt` is an inline-flex with a 6px gap, so
                splitting the count into its own element pads the brackets. */}
            <span className="tnum">{`${tab.label} (${tab.count})`}</span>
          </button>
        ))}
      </div>

      {error ? (
        <Banner tone="err" className="mt-3">
          {error}
        </Banner>
      ) : null}

      <div className="mt-[14px] flex flex-col gap-[10px]">
        {list.isPending ? (
          <div className="card p-4">
            <SkeletonLines />
          </div>
        ) : list.isError ? (
          <Banner tone="err">We could not load this tab. Try again in a moment.</Banner>
        ) : list.data.data.length === 0 ? (
          <EmptyState
            title={`Nothing in ${labelFor(counts, status)}`}
            message="Enquiries land here the moment a buyer taps Enquire or Call on one of your cars."
          />
        ) : (
          list.data.data.map((enquiry) => (
            <EnquiryCard
              key={enquiry.id}
              enquiry={enquiry}
              pending={update.isPending && update.variables?.id === enquiry.id}
              onAction={(next) => update.mutate({ id: enquiry.id, next })}
            />
          ))
        )}
      </div>
    </>
  );
}

function labelFor(tabs: EnquiryCountsResponse['tabs'], status: EnquiryStatus): string {
  return tabs.find((tab) => tab.status === status)?.label ?? status;
}

function EnquiryCard({
  enquiry,
  pending,
  onAction,
}: {
  enquiry: EnquiryDto;
  pending: boolean;
  onAction: (next: EnquiryStatus) => void;
}) {
  const can = (action: string): boolean => enquiry.actions.includes(action);

  return (
    <article className="card gap-[10px] p-[14px]">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar initials={enquiry.initials} size={34} />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold">{enquiry.name}</div>
          <div className="font-mono text-[13px] ink-muted">{enquiry.phoneDisplay}</div>
        </div>
        <Tag variant="accent" className="ml-auto text-[11px]">
          {enquiry.sourceLabel}
        </Tag>
        <span className="whitespace-nowrap text-[11px] ink-faint">{enquiry.timeAgoLabel}</span>
      </div>

      <p className="text-[13px] ink-secondary">
        {enquiry.vehicle ? (
          <>
            On{' '}
            <Link href={enquiry.vehicle.href} className="font-semibold">
              {enquiry.vehicle.title}
            </Link>
            {enquiry.message ? ' — ' : null}
          </>
        ) : (
          <span className="ink-subtle">General enquiry — no vehicle attached. </span>
        )}
        {enquiry.message ? `“${enquiry.message}”` : null}
      </p>

      <div className="flex flex-wrap items-center gap-2 border-t border-(--color-divider) pt-[10px]">
        {can('CONTACT') ? (
          <a
            href={enquiry.callHref}
            className="btn btn-primary max-md:h-11 max-md:w-full max-md:order-first"
          >
            Call <span className="tnum">{enquiry.phoneDisplay}</span>
          </a>
        ) : null}

        {can('EMAIL') && enquiry.emailHref ? (
          <a href={enquiry.emailHref} className="btn btn-secondary">
            Email
          </a>
        ) : null}

        {can('MARK_CONTACTED') ? (
          <Button variant="secondary" loading={pending} onClick={() => onAction('CONTACTED')}>
            Mark contacted
          </Button>
        ) : null}

        {can('REOPEN') ? (
          <Button variant="secondary" loading={pending} onClick={() => onAction('CONTACTED')}>
            Reopen
          </Button>
        ) : null}

        {can('SPAM') ? (
          <Button variant="ghost" loading={pending} onClick={() => onAction('SPAM')}>
            Spam
          </Button>
        ) : null}

        {can('CLOSE') ? (
          <Button
            variant="ghost"
            className="ml-auto"
            loading={pending}
            onClick={() => onAction('CLOSED')}
          >
            Close
          </Button>
        ) : null}
      </div>
    </article>
  );
}
