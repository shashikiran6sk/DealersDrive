import type { PublicConfig } from '@dealers-drive/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SocialIcon } from '@/components/layout/social-icons';
import { Plate } from '@/components/ui/primitives';

/**
 * The buyer footer (**R44**).
 *
 * ## What changed, and why the quiet one was not enough
 *
 * The baseline's footer was one row: a wordmark, the sentence the marketplace
 * rests on, and four links floated right. That is the right footer for a
 * product with four pages, and the wrong one for a product a buyer is asked to
 * hand a phone number to — there was nowhere to find out how to reach a person,
 * and nowhere the platform could be seen to exist off the platform.
 *
 * So it grows into the ordinary shape: a brand column carrying the trust
 * sentence and the social row, then columns of destinations, then a bottom rule
 * with the copyright and the legal posture. Everything that made the old one
 * right is kept — it is still a **server** component that ships no JavaScript
 * (invariant 8), and it still says, on every public page, who is actually
 * selling the car.
 *
 * ## Which links it offers
 *
 * **Exactly the destinations `CustomerHeader` offers, and nothing it invents.**
 * The rule matters because two of them — `/cars` (**F077**) and `/saved`
 * (**F087**) — have not landed yet. The header carries them anyway, deliberately
 * (see its reconstruction note), and a footer that quietly disagreed with the
 * header about which sections the site has would be the more confusing of the
 * two states. What it does *not* do is invent an About, a Terms or a Careers
 * page to fill a column out: a footer link onto a 404 is the product telling a
 * buyer a page exists and then not having it.
 *
 * Everything else here needs no route at all — a `mailto:`, a `tel:` and the
 * social profiles — which is why those columns are complete today.
 *
 * ## Where the social links come from
 *
 * `platform_config`, edited at `/admin/config`, read through
 * `GET /v1/config/public`. Not from code, and not from a `NEXT_PUBLIC_*`
 * variable: an account is opened, renamed and closed on a marketing timescale,
 * and correcting a dead link on every public page in the product should not
 * need a deploy. The API drops any value that is not an `https:` URL before it
 * reaches this component, so an empty or mistyped key renders as a missing icon
 * rather than as a link into nowhere — see `config.service.ts`.
 */
export interface FooterLink {
  href: string;
  label: string;
}

/**
 * The buyer sections, in the header's order.
 *
 * One list rather than three JSX blocks, so "does the footer agree with the
 * header" is a question somebody can answer by reading eight lines.
 */
const BUYER_LINKS: FooterLink[] = [
  { href: '/cars', label: 'Buy cars' },
  { href: '/dealers', label: 'Dealer directory' },
  { href: '/saved', label: 'Saved cars' },
];

/**
 * One door, and it is `/dealer` (**R35**).
 *
 * The console decides between "sign in" and "finish onboarding" from the
 * session, so neither the header nor the footer has to guess which a visitor
 * needs — and therefore neither can get it wrong.
 */
const DEALER_LINKS: FooterLink[] = [{ href: '/dealer', label: 'Dealer login' }];

/**
 * Only what the footer renders, rather than the whole `PublicConfig`.
 *
 * The payload carries eleven fields and this component reads three; taking the
 * whole thing would make every sandbox scenario and every test construct eight
 * values that have no effect on the output.
 *
 * An empty string is "we do not have one" for both contacts — that is what
 * `NO_PUBLIC_CONFIG` degrades to when the API is unreachable, and the row is
 * then absent rather than rendered blank.
 */
export interface CustomerFooterProps {
  social: PublicConfig['social'];
  supportEmail: string;
  supportPhone: string;
}

export function CustomerFooter({ social, supportEmail, supportPhone }: CustomerFooterProps) {
  return (
    <footer className="border-t border-(--color-divider) bg-white">
      {/*
        Explicit tracks rather than `auto-fit`: the brand column has to be the
        wide one, and a span inside an `auto-fit` grid either overflows at one
        column or leaves a dead track at six. One column at 375, two at 640,
        four with a double-width brand at 1024.
      */}
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
          {/*
            An address and a number rather than a contact page, because both are
            true today and a contact form is a route nobody has built. They come
            from `GET /v1/config/public`, so a change of number is an operations
            action rather than a deploy — and each is absent rather than blank
            when the API could not be reached (`NO_PUBLIC_CONFIG`).
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

/**
 * One column: a heading and a list.
 *
 * Each column is its own labelled `<nav>`, named by the heading a sighted
 * reader sees. The alternative — one landmark called "Footer" wrapping
 * everything — hands a screen-reader user a single undifferentiated list of
 * every destination on the page, which is the thing a footer's columns exist to
 * avoid. The `<ul>` inside is what makes each one countable.
 */
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

/**
 * The social row, or nothing at all.
 *
 * Nothing at all is the important half: a fresh deployment has published no
 * accounts, and a row of icons linking to a platform's own homepage — which is
 * what a hard-coded default would be — is worse than an absent row.
 *
 * `rel="noreferrer"` as well as `noopener`: these are the only outbound links
 * on a buyer page, and the referring URL can carry a search a buyer ran.
 */
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
