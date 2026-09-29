import { SUPPORT_TEXT } from './support-page.constants';

export function WhatsappAction({ href }: { href: string | null }) {
  if (!href) {
    return (
      <>
        <span className="btn btn-primary self-start" aria-disabled="true">
          {SUPPORT_TEXT.whatsappAction}
        </span>
        <p className="text-[12px] ink-muted">{SUPPORT_TEXT.whatsappUnavailable}</p>
      </>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-primary self-start">
      {SUPPORT_TEXT.whatsappAction}
      <span aria-hidden="true">{SUPPORT_TEXT.externalArrow}</span>
      <span className="sr-only">{SUPPORT_TEXT.whatsappNewTab}</span>
    </a>
  );
}
