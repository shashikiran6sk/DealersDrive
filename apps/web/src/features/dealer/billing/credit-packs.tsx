'use client';

import type {
  CreditCheckout,
  CreditOrderResult,
  CreditPacksResponse,
} from '@dealers-drive/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Banner, StatusTag } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import {
  createCreditOrderAction,
  verifyCreditOrderAction,
} from '@/features/dealer/billing/billing-actions';
import { BILLING_TEXT } from './billing.constants';
import { PurchaseResult } from './purchase-result';
import type { PurchaseOutcome } from './purchase-result.types';
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

  const packsRef = useRef<HTMLUListElement>(null);
  const [outcome, setOutcome] = useState<PurchaseOutcome | null>(null);
  const [purchased, setPurchased] = useState<CreditOrderResult | null>(null);

  async function settle(
    orderId: string,
    amountLabel: string,
    payment: Parameters<typeof verifyCreditOrderAction>[1],
  ) {
    const verified = await verifyCreditOrderAction(orderId, payment);
    const paymentId = payment.razorpayPaymentId;
    if (!verified.ok) {
      setOutcome({ kind: 'unconfirmed', message: verified.message, paymentId });
    } else if (verified.value.status === 'PAID') {
      setPurchased(verified.value);
      setOutcome({
        kind: 'paid',
        credits: verified.value.credits,
        available: verified.value.available,
        amountLabel,
        paymentId,
      });
    } else {
      setOutcome({ kind: 'pending', amountLabel, paymentId });
    }
  }

  function closeResult(): void {
    setOutcome(null);
    router.refresh();
    if (purchased) {
      setPurchased(null);
      onPurchased?.(purchased);
    }
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
      const checkout = await openCheckout(order.value);
      if (checkout.kind === 'paid') {
        await settle(order.value.orderId, order.value.totalLabel, checkout.payment);
      } else if (checkout.kind === 'failed') {
        setOutcome({ kind: 'failed', packId });
      } else {
        setNotice({ tone: 'warn', message: BILLING_TEXT.dismissed });
      }
    } catch {
      setNotice({ tone: 'err', message: BILLING_TEXT.scriptFailed });
    } finally {
      setBusy(null);
    }
  }

  function retry(packId: string): void {
    setOutcome(null);
    void buy(packId);
  }

  async function confirmSimulated(checkout: CreditCheckout): Promise<void> {
    if (!checkout.simulation) return;
    setBusy(checkout.orderId);
    await settle(checkout.orderId, checkout.totalLabel, {
      razorpayOrderId: checkout.gatewayOrderId,
      razorpayPaymentId: checkout.simulation.paymentId,
      razorpaySignature: checkout.simulation.signature,
    });
    setSimulated(null);
    setBusy(null);
  }

  return (
    <div className={cn('@container flex flex-col gap-3', className)}>
      <PurchaseResult
        outcome={outcome}
        onClose={closeResult}
        onRetry={retry}
        returnFocus={() => packsRef.current?.focus()}
        offerAddVehicle={!onPurchased}
      />
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
      <ul
        ref={packsRef}
        tabIndex={-1}
        className="grid gap-2 outline-none @lg:grid-cols-3 @lg:gap-3"
      >
        {packs.data.map((pack) => (
          <li
            key={pack.id}
            className="card flex flex-row items-center gap-3 p-[12px] @lg:flex-col @lg:items-stretch @lg:gap-2 @lg:p-[16px]"
          >
            <div className="min-w-0 flex-1 @lg:flex-none">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 @lg:justify-between">
                <span className="text-[18px] font-semibold tnum @lg:text-[22px]">
                  {pack.credits}{' '}
                  <span className="text-[13px] font-normal ink-muted">
                    {BILLING_TEXT.creditsUnit(pack.credits)}
                  </span>
                </span>
                {pack.savingsLabel ? <StatusTag tone="ok">{pack.savingsLabel}</StatusTag> : null}
              </div>
              <span className="text-[12px] ink-muted @lg:text-[13px]">{pack.perCreditLabel}</span>
            </div>
            <div className="flex flex-col items-end @lg:items-start">
              <span className="text-[16px] font-semibold tnum @lg:text-[18px]">
                {pack.priceLabel}
              </span>
              {packs.gstPercent > 0 ? (
                <span className="text-[12px] ink-subtle tnum">
                  {BILLING_TEXT.inclGst(pack.totalLabel)}
                </span>
              ) : null}
            </div>
            <Button
              variant="primary"
              className="flex-none @lg:mt-auto"
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
      <p className="text-[12px] ink-subtle">
        {BILLING_TEXT.purchaseTerms}{' '}
        <Link href={BILLING_TEXT.policyHref} className="underline underline-offset-2">
          {BILLING_TEXT.policyLink}
        </Link>
      </p>
      <p className="text-[12px] ink-subtle">{BILLING_TEXT.missingCredits}</p>
    </div>
  );
}
