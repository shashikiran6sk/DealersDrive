import { Plate } from '@/components/ui/primitives';

import { BUYER_LINKS, DEALER_LINKS, FOOTER_TEXT } from './customer-footer.constants';
import type { CustomerFooterProps } from './customer-footer.types';
import { FooterColumn } from './footer-column';
import { FooterLinkItem } from './footer-link-item';
import { SocialRow } from './social-row';

/**
 * The buyer footer (**R44**).
 *
 * The baseline's was one row — a wordmark, the trust sentence and four links
 * floated right — which is the right footer for a product with four pages and
 * the wrong one for a product a buyer is asked to hand a phone number to: there
 * was nowhere to find out how to reach a person. It is still a **server**
 * component shipping no JavaScript (invariant 8).
 *
 * **It offers exactly the destinations `CustomerHeader` offers, and nothing it
 * invents.** Two of them — `/cars` (**F077**) and `/saved` (**F087**) — have not
 * landed, and the header carries them anyway; a footer that quietly disagreed
 * with the header would be the more confusing state. It does not invent an
 * About or a Terms page to fill a column out: a footer link onto a 404 is the
 * product telling a buyer a page exists and then not having it.
 *
 * The social links come from `platform_config` via `GET /v1/config/public`, not
 * from code and not from a `NEXT_PUBLIC_*` variable — an account is opened,
 * renamed and closed on a marketing timescale, and correcting a dead link should
 * not need a deploy. The API drops any value that is not an `https:` URL, so a
 * mistyped key renders as a missing icon rather than a link into nowhere.
 */
export function CustomerFooter({ social, supportEmail, supportPhone }: CustomerFooterProps) {
  return (
    <footer className="border-t border-(--color-divider) bg-white">
      {/*
        Explicit tracks rather than `auto-fit`: the brand column has to be the
        wide one, and a span inside an `auto-fit` grid either overflows at one
        column or leaves a dead track at six.
      */}
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-9 px-6 py-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-12">
        <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-[9px]">
            <Plate size="logo">DD</Plate>
            <span className="font-heading text-[15px] font-bold">{FOOTER_TEXT.brand}</span>
          </div>

          <p className="max-w-[46ch] text-[12px] leading-[1.6] ink-subtle">{FOOTER_TEXT.trust}</p>

          <SocialRow links={social} />
        </div>

        <FooterColumn title={FOOTER_TEXT.buyColumn}>
          {BUYER_LINKS.map((link) => (
            <FooterLinkItem key={link.href} {...link} />
          ))}
        </FooterColumn>

        <FooterColumn title={FOOTER_TEXT.dealerColumn}>
          {DEALER_LINKS.map((link) => (
            <FooterLinkItem key={link.href} {...link} />
          ))}
          <li className="max-w-[26ch] pt-1 text-[11px] leading-[1.6] ink-faint">
            {FOOTER_TEXT.dealerNote}
          </li>
        </FooterColumn>

        <FooterColumn title={FOOTER_TEXT.supportColumn}>
          {/*
            An address and a number rather than a contact page, because both are
            true today and a contact form is a route nobody has built. Each is
            absent rather than blank when the API could not be reached.
          */}
          {supportEmail ? (
            <li>
              <a href={`mailto:${supportEmail}`} className="text-[13px] ink-secondary">
                {supportEmail}
              </a>
            </li>
          ) : null}
          {supportPhone ? (
            <li>
              <a href={`tel:${supportPhone}`} className="text-[13px] ink-secondary tnum">
                {supportPhone}
              </a>
            </li>
          ) : null}
        </FooterColumn>
      </div>

      <div className="border-t border-(--color-rule)">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-2 px-6 py-4 text-[11px] ink-faint">
          <span className="tnum">{FOOTER_TEXT.copyright(new Date().getFullYear())}</span>
          <span>{FOOTER_TEXT.disclaimer}</span>
        </div>
      </div>
    </footer>
  );
}
