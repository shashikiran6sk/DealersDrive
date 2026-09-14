import type { PublicConfig } from '@dealers-drive/contracts';

import { SocialIcon } from '@/components/layout/social-icons';

import { FOOTER_TEXT } from './customer-footer.constants';

export function SocialRow({ links }: { links: PublicConfig['social'] }) {
  if (links.length === 0) return null;

  return (
    <nav aria-label={FOOTER_TEXT.socialNavLabel}>
      <ul className="flex flex-wrap items-center gap-2">
        {links.map((link) => (
          <li key={link.network}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              title={link.label}
              aria-label={FOOTER_TEXT.socialLinkLabel(link.label)}
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
