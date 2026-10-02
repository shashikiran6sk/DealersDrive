'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import {
  enquiryCustomerAction,
  sendEnquiryAction,
  type EnquiryCustomer,
  type SendEnquiryState,
} from '@/features/enquiry/actions';

import { EnquiryForm } from './enquiry-form';
import { ENQUIRY_PANEL_TEXT, loginHref, MY_ENQUIRIES_HREF } from './enquiry-panel.constants';
import type { EnquiryPanelProps, EnquiryPanelStage } from './enquiry-panel.types';

export function EnquiryPanel({ listingSlug, dealerName, autoOpen = false }: EnquiryPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [stage, setStage] = useState<EnquiryPanelStage>(autoOpen ? 'checking' : 'idle');
  const [customer, setCustomer] = useState<EnquiryCustomer | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const autoOpened = useRef(false);

  const open = useCallback(async () => {
    setStage('checking');
    setNotice(null);
    let signedIn: EnquiryCustomer | null;
    try {
      signedIn = await enquiryCustomerAction();
    } catch {
      setNotice(ENQUIRY_PANEL_TEXT.openFailed);
      setStage('idle');
      return;
    }
    if (!signedIn) {
      router.push(loginHref(pathname));
      return;
    }
    setCustomer(signedIn);
    setStage('form');
    panel.current?.scrollIntoView({ block: 'nearest' });
  }, [pathname, router]);

  useEffect(() => {
    if (!autoOpen || autoOpened.current) return;
    autoOpened.current = true;
    void open();
  }, [autoOpen, open]);

  useEffect(() => {
    if (autoOpen) return;
    let live = true;
    enquiryCustomerAction()
      .then((found) => {
        if (live && found) setCustomer(found);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked once on mount; autoOpen asks through open()
  }, []);

  async function send(message: string): Promise<SendEnquiryState> {
    let result: SendEnquiryState;
    try {
      result = await sendEnquiryAction(listingSlug, message);
    } catch {
      return { status: 'refused', code: 'UNAVAILABLE', message: ENQUIRY_PANEL_TEXT.sendFailed };
    }
    if (result.status === 'sent') {
      setStage('sent');
      if (autoOpen) router.replace(pathname, { scroll: false });
    }
    if (result.status === 'signed-out') router.push(loginHref(pathname));
    if (result.status === 'refused' && result.code === 'ENQUIRY_ALREADY_OPEN') {
      setNotice(result.message);
      setStage('already');
    }
    if (result.status === 'refused' && result.code === 'LISTING_NOT_AVAILABLE') {
      setNotice(result.message);
      setStage('gone');
    }
    return result;
  }

  return (
    <div ref={panel} className="flex flex-col gap-[10px]" aria-live="polite">
      {stage === 'idle' && notice ? (
        <Banner tone="err" title={ENQUIRY_PANEL_TEXT.openFailedTitle}>
          {notice}
        </Banner>
      ) : null}

      {stage === 'idle' || stage === 'checking' ? (
        <>
          <Button
            variant="primary"
            size="md"
            block
            className="min-h-[44px]"
            loading={stage === 'checking'}
            aria-label={stage === 'checking' ? ENQUIRY_PANEL_TEXT.loading : undefined}
            onClick={() => {
              void open();
            }}
          >
            {ENQUIRY_PANEL_TEXT.enquire}
          </Button>
          {customer ? null : (
            <p className="m-0 text-center text-[12px] ink-secondary">
              {ENQUIRY_PANEL_TEXT.requiresLogin}
            </p>
          )}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-(--color-divider) bg-white p-[10px] shadow-(--shadow-lg) lg:hidden">
            <Button
              variant="primary"
              size="md"
              block
              className="min-h-[44px]"
              loading={stage === 'checking'}
              onClick={() => {
                void open();
              }}
            >
              {ENQUIRY_PANEL_TEXT.enquire}
            </Button>
            {customer ? null : (
              <p className="m-0 mt-[4px] text-center text-[11px] ink-secondary">
                {ENQUIRY_PANEL_TEXT.requiresLogin}
              </p>
            )}
          </div>
        </>
      ) : null}

      {stage === 'form' && customer ? (
        <EnquiryForm
          customer={customer}
          dealerName={dealerName}
          onSend={send}
          onCancel={() => {
            setStage('idle');
          }}
        />
      ) : null}

      {stage === 'sent' ? (
        <Banner tone="ok" title={ENQUIRY_PANEL_TEXT.sentTitle}>
          {ENQUIRY_PANEL_TEXT.sentBody(dealerName)}{' '}
          <Link href={MY_ENQUIRIES_HREF} className="font-medium underline">
            {ENQUIRY_PANEL_TEXT.track}
          </Link>
        </Banner>
      ) : null}

      {stage === 'already' ? (
        <Banner tone="warn" title={ENQUIRY_PANEL_TEXT.alreadySentTitle}>
          {notice}{' '}
          <Link href={MY_ENQUIRIES_HREF} className="font-medium underline">
            {ENQUIRY_PANEL_TEXT.track}
          </Link>
        </Banner>
      ) : null}

      {stage === 'gone' ? (
        <Banner tone="err" title={ENQUIRY_PANEL_TEXT.unavailableTitle}>
          {notice}
        </Banner>
      ) : null}
    </div>
  );
}
