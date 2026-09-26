import {
  PHOTOGRAPHY_STATUS_LABELS,
  PhotographyStatus,
  type AdminListingDetail,
} from '@dealers-drive/contracts';

import { Field } from '@/components/forms/field';
import { Select, Textarea } from '@/components/ui/input';
import { StatusTag } from '@/components/ui/primitives';
import { setPhotographyAction } from '@/features/admin/listing-actions';
import { ListingImages } from '@/features/admin/listing-images';

import { LISTING_REVIEW_TEXT } from './listing-review.constants';

export function PhotographyPanel({ detail }: { detail: AdminListingDetail }) {
  const { photography, listing } = detail;

  return (
    <section aria-labelledby="photography-heading" className="card gap-[10px] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="photography-heading" className="text-[16px]">
          {LISTING_REVIEW_TEXT.photography}
        </h2>
        <StatusTag tone={photography.tone}>{photography.label}</StatusTag>
      </div>
      {photography.note && !photography.canUpdate ? (
        <p className="text-[12px] ink-body">{photography.note}</p>
      ) : null}

      {photography.canUpdate ? (
        <form
          action={setPhotographyAction}
          className="flex flex-col gap-[10px] border-t border-(--color-divider) pt-[10px]"
        >
          <input type="hidden" name="listingId" value={listing.id} />
          <Field id="photography-status" label={LISTING_REVIEW_TEXT.photographyStatus}>
            <Select id="photography-status" name="status" defaultValue={photography.status}>
              {PhotographyStatus.options.map((status) => (
                <option key={status} value={status}>
                  {PHOTOGRAPHY_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="photography-note"
            label={LISTING_REVIEW_TEXT.photographyNote}
            hint={LISTING_REVIEW_TEXT.photographyNoteHint}
          >
            <Textarea
              id="photography-note"
              name="note"
              rows={2}
              maxLength={500}
              defaultValue={photography.note ?? ''}
            />
          </Field>
          <button type="submit" className="btn btn-secondary self-start">
            {LISTING_REVIEW_TEXT.photographySave}
          </button>
        </form>
      ) : null}

      <ListingImages listingId={listing.id} images={detail.images} />
    </section>
  );
}
