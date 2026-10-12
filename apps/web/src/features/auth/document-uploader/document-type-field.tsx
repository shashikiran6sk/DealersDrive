'use client';

import { DOC_CATEGORY_TYPES, DOC_TYPE_HINTS, DOC_TYPE_LABELS } from '@dealers-drive/contracts';

import { DESCRIPTION_LIMITS, DOCUMENT_UPLOADER_TEXT } from './document-uploader.constants';
import type { DocumentTypeFieldProps } from './document-uploader.types';
import { categoryType, needsDescription } from './utils';

export function DocumentTypeField({
  id,
  category,
  type,
  onTypeChange,
  description,
  onDescriptionChange,
  gstinOnFile,
  disabled,
}: DocumentTypeFieldProps) {
  const typeId = `${id}-type`;
  const hintId = `${id}-hint`;
  const descriptionId = `${id}-description`;
  const hint = type ? DOC_TYPE_HINTS[type] : undefined;
  const gstMismatch = category === 'BUSINESS_IDENTITY' && gstinOnFile && type !== 'GST_CERTIFICATE';

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="field">
        <label htmlFor={typeId}>{DOCUMENT_UPLOADER_TEXT.typeLabel}</label>
        <select
          id={typeId}
          className="input"
          value={type}
          disabled={disabled}
          aria-describedby={hint || gstMismatch ? hintId : undefined}
          onChange={(event) => onTypeChange(categoryType(category, event.target.value))}
        >
          <option value="">{DOCUMENT_UPLOADER_TEXT.typePlaceholder}</option>
          {DOC_CATEGORY_TYPES[category].map((option) => (
            <option key={option} value={option}>
              {DOC_TYPE_LABELS[option]}
            </option>
          ))}
        </select>
        {hint || gstMismatch ? (
          <div id={hintId} className="mt-1 flex flex-col gap-[2px] text-[12px] ink-subtle">
            {hint ? <span>{hint}</span> : null}
            {gstMismatch ? (
              <span className="text-(--color-warn)">{DOCUMENT_UPLOADER_TEXT.gstRequired}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {needsDescription(type) ? (
        <div className="field">
          <label htmlFor={descriptionId}>{DOCUMENT_UPLOADER_TEXT.descriptionLabel}</label>
          <input
            id={descriptionId}
            className="input"
            value={description}
            disabled={disabled}
            required
            aria-required="true"
            minLength={DESCRIPTION_LIMITS.min}
            maxLength={DESCRIPTION_LIMITS.max}
            placeholder={DOCUMENT_UPLOADER_TEXT.descriptionPlaceholder}
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
