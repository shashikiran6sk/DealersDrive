import { buttonClass } from '@/components/ui/button';

import { PHOTO_GUIDE_ASSETS, PHOTO_STANDARD_TEXT } from './photo-standard.constants';

export function GuideDownloadLink({
  variant = 'secondary',
}: {
  variant?: 'primary' | 'secondary';
}) {
  return (
    <a
      href={PHOTO_GUIDE_ASSETS.pdf}
      download={PHOTO_GUIDE_ASSETS.pdfName}
      className={buttonClass({ variant, className: 'self-start' })}
    >
      {PHOTO_STANDARD_TEXT.downloadPdf}
    </a>
  );
}
