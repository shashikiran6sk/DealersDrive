'use client';

import type {
  CreditCheckout,
  CreditOrderResult,
  CreditPacksResponse,
} from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Banner, StatusTag } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import {
  createCreditOrderAction,
  verifyCreditOrderAction,
} from '@/features/dealer/billing/billing-actions';
import { BILLING_TEXT } from './billing.constants';
import { openCheckout } from './razorpay';

export interface CreditPacksProps {
  packs: CreditPacksResponse;
  canPurchase: boolean;
  onPurchased?: (result: CreditOrderResult) => void;
  className?: string;
}

type Notice = { tone: 'ok' | 'warn' | 'err'; message: string } | null;

export function CreditPacks({ packs, canPurchase, onPurchased, className }: CreditPacksProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [simulated, setSimulated] = useState<CreditCheckout | null>(null);

  async function settle(orderId: string, payment: Parameters<typeof verifyCreditOrderAction>[1]) {
    const verified = await verifyCreditOrderAction(orderId, payment);
    if (!verified.ok) {
      setNotice({ tone: 'err', message: verified.message });
    } else if (verified.value.status === 'PAID') {
      setNotice({ tone: 'ok', message: BILLING_TEXT.paid(verified.value.message) });
      onPurchased?.(verified.value);
    } else {
      setNotice({ tone: 'warn', message: BILLING_TEXT.pending });
    }
    router.refresh();
  }

  async function buy(packId: string): Promise<void> {
    setBusy(packId);
    setNotice(null);
    try {
      const order = await createCreditOrderAction(packId);
      if (!order.ok) {
        setNotice({ tone: 'err', message: order.message });
        return;
      }
      if (order.value.simulation) {
        setSimulated(order.value);
        return;
      }
      const outcome = await openCheckout(order.value);
      if (outcome.kind === 'paid') await settle(order.value.orderId, outcome.payment);
      else
        setNotice({
          tone: 'warn',
          message: outcome.kind === 'dismissed' ? BILLING_TEXT.dismissed : BILLING_TEXT.failed,
        });
    } catch {
      setNotice({ tone: 'err', message: BILLING_TEXT.scriptFailed });
    } finally {
      setBusy(null);
    }
  }

  async function confirmSimulated(checkout: CreditCheckout): Promise<void> {
    if (!checkout.simulation) return;
    setBusy(checkout.orderId);
    await settle(checkout.orderId, {
      razorpayOrderId: checkout.gatewayOrderId,
      razorpayPaymentId: checkout.simulation.paymentId,
      razorpaySignature: checkout.simulation.signature,
    });
    setSimulated(null);
    setBusy(null);
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {notice ? <Banner tone={notice.tone}>{notice.message}</Banner> : null}
      {!packs.purchasable ? <Banner tone="warn">{BILLING_TEXT.gatewayOff}</Banner> : null}
      {packs.purchasable && !canPurchase ? (
        <Banner tone="warn">{BILLING_TEXT.ownerOnly}</Banner>
      ) : null}
      {simulated ? (
        <Banner
          tone="warn"
          title={BILLING_TEXT.simulatedTitle}
          action={
            <span className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSimulated(null)}>
                {BILLING_TEXT.cancel}
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={busy === simulated.orderId}
                onClick={() => void confirmSimulated(simulated)}
              >
                {BILLING_TEXT.simulatedConfirm}
              </Button>
            </span>
          }
        >
          {BILLING_TEXT.simulatedBody} {simulated.totalLabel}
        </Banner>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-3">
        {packs.data.map((pack) => (
          <li key={pack.id} className="card flex flex-col gap-2 p-[16px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[22px] font-semibold tnum">
                {pack.credits}{' '}
                <span className="text-[13px] font-normal ink-muted">
                  {BILLING_TEXT.creditsUnit(pack.credits)}
                </span>
              </span>
              {pack.savingsLabel ? <StatusTag tone="ok">{pack.savingsLabel}</StatusTag> : null}
            </div>
            <span className="text-[13px] ink-muted">{pack.perCreditLabel}</span>
            <span className="text-[18px] font-semibold tnum">{pack.priceLabel}</span>
            <span className="text-[12px] ink-subtle tnum">
              {BILLING_TEXT.inclGst(pack.totalLabel)}
            </span>
            <Button
              variant="primary"
              className="mt-auto"
              disabled={!packs.purchasable || !canPurchase || busy !== null}
              loading={busy === pack.id}
              onClick={() => void buy(pack.id)}
            >
              {busy === pack.id ? BILLING_TEXT.buying : BILLING_TEXT.buy}
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-[12px] ink-subtle">{packs.taxNote}</p>
    </div>
  );
}
