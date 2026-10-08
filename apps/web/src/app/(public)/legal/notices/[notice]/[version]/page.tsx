export const dynamic = 'force-dynamic';
import { legalNoticeSnapshot } from '@dealers-drive/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { legalPagesVisible } from '@/lib/legal-release';
export const metadata = { title: 'Recorded notice', robots: { index: false, follow: false } };
export default async function NoticeSnapshot({
  params,
}: {
  params: Promise<{ notice: string; version: string }>;
}) {
  const value = await params;
  if (!legalPagesVisible() || (value.notice !== 'enquiry' && value.notice !== 'certification'))
    notFound();
  const notice = legalNoticeSnapshot(value.notice, value.version);
  if (!notice) notFound();
  return (
    <article className="mx-auto max-w-[76ch] px-4 py-12 sm:px-6">
      <h1 className="text-[30px] font-extrabold">
        {value.notice === 'enquiry' ? 'Enquiry sharing notice' : 'Listing declaration'}
      </h1>
      <p className="mt-4 text-[13px] ink-subtle">Archived snapshot · version {notice.version}</p>
      <p className="mt-4 text-[14px] leading-[1.8]">
        This draft has no effective date and is not approved for production publication.
      </p>
      <p className="mt-6 text-[16px] leading-[1.9]">{notice.text}</p>
      <p className="mt-6 text-[14px]">
        <Link
          href={`/legal/${value.notice === 'enquiry' ? 'privacy' : 'listing'}/${notice.version}`}
          className="underline"
        >
          Read the associated policy snapshot
        </Link>{' '}
        ·{' '}
        <Link href="/agreements" className="underline">
          My agreements
        </Link>
      </p>
    </article>
  );
}
