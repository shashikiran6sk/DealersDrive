'use client';

import { useState, useId, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { websiteCommitUploadAction, websiteUploadAction } from '../actions';
import { WebsiteUploadContext } from '../action-form/upload-context';

export function WebsiteMediaPicker({
  name,
  label,
  initialIds = [],
  multiple = false,
}: {
  name: string;
  label: string;
  initialIds?: string[];
  multiple?: boolean;
}) {
  const trackUpload = useContext(WebsiteUploadContext);
  const id = useId();
  const [ids, setIds] = useState(initialIds);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(files: FileList | null) {
    if (!files) return;
    const selected = [...files];
    if ((multiple ? ids.length + selected.length : selected.length) > (multiple ? 6 : 1)) {
      setError(multiple ? 'Choose up to six yard images.' : 'Choose one image.');
      return;
    }
    setPending(true);
    setError(null);
    trackUpload(1);
    const uploaded: string[] = [];
    try {
      for (const file of selected) {
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
          file.size > 8 * 1024 * 1024 ||
          file.size === 0
        )
          throw new Error('Choose a JPEG, PNG or WebP image smaller than 8 MiB.');
        const presigned = await websiteUploadAction({
          fileName: file.name,
          mimeType: file.type,
          bytes: file.size,
        });
        if (!presigned.upload?.mediaId)
          throw new Error(presigned.error ?? 'The upload could not be prepared.');
        const response = await fetch(presigned.upload.uploadUrl, {
          method: 'PUT',
          headers: Object.fromEntries(
            Object.entries(presigned.upload.headers).filter(
              ([key]) => key.toLowerCase() !== 'content-length',
            ),
          ),
          body: file,
        });
        if (!response.ok) throw new Error('The image upload failed. Please retry.');
        const committed = await websiteCommitUploadAction(presigned.upload.mediaId);
        if (!committed.media) throw new Error(committed.error);
        uploaded.push(committed.media.mediaId);
      }
      setIds((current) => (multiple ? [...current, ...uploaded] : uploaded));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The image could not be uploaded.');
    } finally {
      setPending(false);
      trackUpload(-1);
    }
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input type="hidden" name={name} value={ids.join(',')} />
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        disabled={pending}
        onChange={(event) => void upload(event.target.files)}
        className="input min-h-[48px] py-3"
      />
      <p className="text-[12px] ink-muted">
        JPEG, PNG or WebP · up to 8 MiB. Save branding after the upload finishes.
      </p>
      {pending ? <p role="status">Processing image…</p> : null}
      {ids.length ? (
        <div className="flex flex-wrap gap-3">
          {ids.map((mediaId, index) => (
            <div key={mediaId} className="flex w-[112px] flex-col gap-2">
              <img
                src={`/api/website/media/${mediaId}/320.webp`}
                alt={`${label} ${index + 1}`}
                width={112}
                height={80}
                className="h-[80px] w-[112px] rounded-lg object-cover"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => setIds((current) => current.filter((value) => value !== mediaId))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-(--color-err)">
          {error}
        </p>
      ) : null}
    </div>
  );
}
