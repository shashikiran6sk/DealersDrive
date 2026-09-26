import { AdminListingDetail } from '@dealers-drive/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ListingReview } from '@/features/admin/listing-review';
import { ApiError, apiGetParsed } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Review listing' };

export default async function AdminListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail: AdminListingDetail;
  try {
    detail = await apiGetParsed(
      AdminListingDetail,
      `/v1/admin/listings/${encodeURIComponent(id)}`,
      {
        revalidate: false,
      },
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  return <ListingReview detail={detail} />;
}
