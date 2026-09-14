import type { PublicConfig } from '@dealers-drive/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SocialIcon } from '@/components/layout/social-icons';
import { Plate } from '@/components/ui/primitives';

export interface FooterLink {
  href: string;
  label: string;
}

const BUYER_LINKS: FooterLink[] = [
  { href: '/cars', label: 'Buy cars' },
  { href: '/dealers', label: 'Dealer directory' },
  { href: '/saved', label: 'Saved cars' },
];

const DEALER_LINKS: FooterLink[] = [{ href: '/dealer', label: 'Dealer login' }];

export interface CustomerFooterProps {
  social: PublicConfig['social'];
  supportEmail: string;
  supportPhone: string;
}

export function CustomerFooter({ social, supportEmail, supportPhone }: CustomerFooterProps) {
  return (
    <footer className="border-t border-(--color-divider) bg-white">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-9 px-6 py-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] lg:gap-12">
        <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-[9px]">
            <Plate size="logo">DD</Plate>
            <span className="font-heading text-[15px] font-bold">Dealers-Drive</span>
          </div>

          <p className="max-w-[46ch] text-[12px] leading-[1.6] ink-subtle">
            Dealers-Drive verifies dealer identity and business documents. Every vehicle is owned,
            priced and warranted by the dealer who lists it.
          </p>

          <SocialRow links={social} />
        </div>

        <FooterColumn title="Buy a car">
          {BUYER_LINKS.map((link) => (
            <FooterLinkItem key={link.href} {...link} />
          ))}
        </FooterColumn>

        <FooterColumn title="For dealers">
          {DEALER_LINKS.map((link) => (
            <FooterLinkItem key={link.href} {...link} />
          ))}
          <li className="max-w-[26ch] pt-1 text-[11px] leading-[1.6] ink-faint">
            Identity and business documents are checked before a dealership can list.
          </li>
        </FooterColumn>

        <FooterColumn title="Support">
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
          <span className="tnum">© {new Date().getFullYear()} Dealers-Drive</span>
          <span>
            A marketplace for verified independent dealers. Dealers-Drive is not a party to any
            sale.
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav className="flex flex-col gap-[10px]" aria-label={title}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] ink-muted">{title}</h2>
      <ul className="flex flex-col gap-[7px]">{children}</ul>
    </nav>
  );
}

function FooterLinkItem({ href, label }: FooterLink) {
  return (
    <li>
      <Link href={href} className="text-[13px] ink-secondary">
        {label}
      </Link>
    </li>
  );
}

function SocialRow({ links }: { links: PublicConfig['social'] }) {
  if (links.length === 0) return null;

  return (
    <nav aria-label="Dealers-Drive on social media">
      <ul className="flex flex-wrap items-center gap-2">
        {links.map((link) => (
          <li key={link.network}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              title={link.label}
              aria-label={`Dealers-Drive on ${link.label}`}
              className="flex h-8 w-8 items-center justify-center border border-(--color-divider) ink-muted hover:border-(--color-accent) hover:text-(--color-accent)"
            >
              <SocialIcon network={link.network} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
