import { mailtoHref, SUPPORT_TEXT, telHref } from './support-page.constants';
import type { ContactLinesProps } from './support-page.types';

export function ContactLines({ contact }: ContactLinesProps) {
  return (
    <dl className="flex flex-col gap-[8px] text-[14px]">
      {contact.email ? (
        <div className="flex flex-col">
          <dt className="text-[12px] ink-muted">{SUPPORT_TEXT.emailLabel}</dt>
          <dd className="m-0">
            <a
              href={mailtoHref(contact.email)}
              className="font-extrabold [overflow-wrap:anywhere] underline underline-offset-4"
            >
              {contact.email}
            </a>
          </dd>
        </div>
      ) : null}
      {contact.phone ? (
        <div className="flex flex-col">
          <dt className="text-[12px] ink-muted">{SUPPORT_TEXT.phoneLabel}</dt>
          <dd className="m-0">
            <a
              href={telHref(contact.phone)}
              className="font-extrabold underline underline-offset-4 tnum"
            >
              {contact.phone}
            </a>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
