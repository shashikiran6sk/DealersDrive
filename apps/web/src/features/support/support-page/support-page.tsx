import { ContactLines } from './contact-lines';
import { SupportCard } from './support-card';
import { SUPPORT_TEXT } from './support-page.constants';
import type { SupportPageProps } from './support-page.types';
import { WhatsappAction } from './whatsapp-action';

export function SupportPage({ support }: SupportPageProps) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pt-[40px] pb-[72px] sm:px-6 md:pt-[52px]">
      <div className="eyebrow">{SUPPORT_TEXT.eyebrow}</div>
      <h1 className="mt-[10px] text-[30px] sm:text-[34px]">{SUPPORT_TEXT.title}</h1>
      <p className="mt-[10px] max-w-[68ch] text-[15px] ink-muted">{SUPPORT_TEXT.intro}</p>

      <div className="mt-[28px] grid grid-cols-1 gap-4 md:grid-cols-3">
        <SupportCard
          icon="customer"
          headingId="support-customer"
          title={SUPPORT_TEXT.customerTitle}
          body={SUPPORT_TEXT.customerBody}
        >
          <ContactLines contact={support.customer} />
        </SupportCard>
        <SupportCard
          icon="dealer"
          headingId="support-dealer"
          title={SUPPORT_TEXT.dealerTitle}
          body={SUPPORT_TEXT.dealerBody}
        >
          <ContactLines contact={support.dealer} />
        </SupportCard>
        <SupportCard
          icon="chat"
          headingId="support-whatsapp"
          title={SUPPORT_TEXT.whatsappTitle}
          body={SUPPORT_TEXT.whatsappBody}
        >
          <WhatsappAction href={support.whatsappHref} />
        </SupportCard>
      </div>

      <p className="mt-[26px] max-w-[68ch] text-[13px] ink-muted">{SUPPORT_TEXT.help}</p>
    </div>
  );
}
