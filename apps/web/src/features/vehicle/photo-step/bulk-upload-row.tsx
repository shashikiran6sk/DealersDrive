import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

import { PHOTO_STEP_TEXT } from './photo-step.constants';

export type BulkUploadRowStatus = 'uploaded' | 'uploading' | 'waiting' | 'failed';

export interface BulkUploadRowProps {
  name: string;
  status: BulkUploadRowStatus;
  message?: string | null;
  busy?: boolean;
  onRemove?: () => void;
}

const STATUS_TEXT: Record<BulkUploadRowStatus, string> = {
  uploaded: PHOTO_STEP_TEXT.bulkUploaded,
  uploading: PHOTO_STEP_TEXT.uploading,
  waiting: PHOTO_STEP_TEXT.bulkWaiting,
  failed: PHOTO_STEP_TEXT.bulkFailed,
};

export function BulkUploadRow({
  name,
  status,
  message,
  busy = false,
  onRemove,
}: BulkUploadRowProps) {
  return (
    <li className="flex items-center gap-[10px] py-[8px]">
      <span
        aria-hidden
        className={cn(
          'inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white',
          status === 'uploaded'
            ? 'bg-(--color-ok)'
            : status === 'failed'
              ? 'bg-(--color-err)'
              : 'bg-(--color-accent-400)',
        )}
      >
        {status === 'uploaded' ? '✓' : status === 'failed' ? '!' : '…'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{name}</span>
        <span
          className={cn(
            'block text-[12px]',
            status === 'failed' ? 'text-(--color-err)' : 'ink-muted',
          )}
        >
          {status === 'failed' && message ? message : STATUS_TEXT[status]}
        </span>
      </span>
      {onRemove ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          aria-label={PHOTO_STEP_TEXT.bulkRemove(name)}
          onClick={onRemove}
        >
          {PHOTO_STEP_TEXT.remove}
        </Button>
      ) : null}
    </li>
  );
}
