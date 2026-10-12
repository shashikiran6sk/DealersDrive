'use client';

import { PORTFOLIO_PHOTO_MIME_TYPES } from '@dealers-drive/contracts';
import { useId, useState } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { fileRejection } from '@/lib/upload';

import {
  PORTFOLIO_CAPTION_MAX,
  PORTFOLIO_PHOTO_RULE,
  PORTFOLIO_TEXT,
} from './portfolio-manager.constants';
import type { PortfolioUploadDialogProps } from './portfolio-manager.types';

export function PortfolioUploadDialog({
  title,
  description,
  trigger,
  onSubmit,
}: PortfolioUploadDialogProps) {
  const id = useId();
  const fileId = `${id}-file`;
  const captionId = `${id}-caption`;
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(): void {
    setFile(null);
    setCaption('');
    setError(null);
  }

  function choose(chosen: File | undefined): void {
    setError(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    const rejection = fileRejection(chosen, PORTFOLIO_PHOTO_RULE);
    if (rejection) {
      setFile(null);
      setError(rejection);
      return;
    }
    setFile(chosen);
  }

  async function submit(): Promise<void> {
    if (!file) return;
    setBusy(true);
    setError(null);
    const failure = await onSubmit(file, caption);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    reset();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) reset();
      }}
      title={title}
      description={description}
      trigger={trigger}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
            {PORTFOLIO_TEXT.cancel}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={busy || file === null}
            onClick={() => void submit()}
          >
            {PORTFOLIO_TEXT.submit}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? <Banner tone="err">{error}</Banner> : null}

        <Field id={fileId} label={PORTFOLIO_TEXT.fileLabel} hint={PORTFOLIO_TEXT.fileHint}>
          <input
            id={fileId}
            type="file"
            className="input"
            accept={PORTFOLIO_PHOTO_MIME_TYPES.join(',')}
            disabled={busy}
            onChange={(event) => choose(event.target.files?.[0])}
          />
        </Field>

        <Field
          id={captionId}
          label={PORTFOLIO_TEXT.captionLabel}
          hint={PORTFOLIO_TEXT.captionHint(PORTFOLIO_CAPTION_MAX)}
        >
          <Input
            id={captionId}
            value={caption}
            maxLength={PORTFOLIO_CAPTION_MAX}
            disabled={busy}
            placeholder={PORTFOLIO_TEXT.captionPlaceholder}
            onChange={(event) => setCaption(event.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}
