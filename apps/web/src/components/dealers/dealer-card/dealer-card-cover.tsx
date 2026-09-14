import type { DealerCard as DealerCardDto } from '@dealers-drive/contracts';

import { ImageSlot } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

import { COVER_HEIGHT, DEALER_CARD_TEXT } from './dealer-card.constants';

/** The 128px cover band: the yard photograph, or the slot that names it. */
export function DealerCardCover({ dealer }: { dealer: DealerCardDto }) {
  return (
    <div
      className={cn(
        'relative w-full shrink-0 overflow-hidden border-b border-(--color-divider) bg-(--color-surface)',
        COVER_HEIGHT,
      )}
    >
      {dealer.coverUrl ? (
        <>
          {/*
           * `alt=""` on purpose: the heading already names the dealership, and a
           * screen reader announcing "Annamalai Auto Mart — yard photo" right
           * before the link that says "Annamalai Auto Mart" is noise.
           *
           * A plain `<img>` rather than `next/image` because the bytes come from
           * `MEDIA_BASE_URL`, which moves per environment — configuring
           * `remotePatterns` for it trades a build-time constant for a runtime
           * 400.
           */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dealer.coverUrl} alt="" className="h-full w-full object-cover" />
          {/*
           * A wash into the bottom edge, so the white logo tile that straddles it
           * has something to sit against — a yard photograph is often a bright
           * forecourt, and a white tile on white sky is the one place the overlap
           * stops reading as one. Only over a photograph: the `ImageSlot` is a
           * flat panel that would only be dirtied by it.
           */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent"
          />
        </>
      ) : (
        /* Naming the shot rather than showing a grey rectangle is what makes the
           gap read as pending rather than broken. */
        <ImageSlot label={DEALER_CARD_TEXT.coverAlt(dealer.brandName)} />
      )}

      {/*
        The audit mark, in the place a buyer looks first — the photograph is the
        thing that could be anybody's forecourt, and the mark says this one was
        stood in. No year on it: nothing records when a yard was audited, and a
        date the product cannot stand behind is worse than no date.
      */}
      {dealer.isVerified ? (
        <span className="absolute right-[10px] top-[10px] bg-ink/75 px-[7px] py-[2px] font-mono text-[10px] tracking-[0.08em] text-white backdrop-blur-[2px]">
          {DEALER_CARD_TEXT.yardVerified}
        </span>
      ) : null}
    </div>
  );
}
