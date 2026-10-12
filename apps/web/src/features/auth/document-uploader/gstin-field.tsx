import { Field, invalidProps } from '@/components/forms/field';

import { DOCUMENT_UPLOADER_TEXT, GSTIN_LENGTH } from './document-uploader.constants';
import type { GstinFieldProps } from './document-uploader.types';

export function GstinField({ id, value, onChange, error, disabled }: GstinFieldProps) {
  return (
    <Field
      id={id}
      label={DOCUMENT_UPLOADER_TEXT.gstinLabel}
      hint={DOCUMENT_UPLOADER_TEXT.gstinHint}
      error={error ?? undefined}
    >
      <input
        id={id}
        className="input font-mono uppercase"
        value={value}
        maxLength={GSTIN_LENGTH}
        placeholder={DOCUMENT_UPLOADER_TEXT.gstinPlaceholder}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        {...invalidProps(id, error ?? undefined)}
      />
    </Field>
  );
}
