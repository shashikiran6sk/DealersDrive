import { Plate } from '@/components/ui/primitives';

import { BUYER_LINKS, DEALER_LINKS, FOOTER_TEXT } from './customer-footer.constants';
import type { CustomerFooterProps } from './customer-footer.types';
import { FooterColumn } from './footer-column';
import { FooterLinkItem } from './footer-link-item';
import { SocialRow } from './social-row';

export function CustomerFooter({ social, supportEmail, supportPhone }: CustomerFooterProps) {
  return (
    <footer className="border-t border-(--color-divider) bg-white">
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
