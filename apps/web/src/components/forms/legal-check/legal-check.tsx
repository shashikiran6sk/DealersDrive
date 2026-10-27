import { LEGAL_CHECK_TEXT } from './legal-check.constants';

export function LegalCheck({ disabled = false }: { disabled?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-[14px] leading-6 ink-body">
      <input
        id="legal-acceptance"
        name="accepted"
        type="checkbox"
        value="true"
        required
        disabled={disabled}
        className="mt-1 h-5 w-5 shrink-0 accent-(--color-ink) focus-visible:outline-2 focus-visible:outline-offset-4"
      />
      <label htmlFor="legal-acceptance">
        {LEGAL_CHECK_TEXT.before}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          {LEGAL_CHECK_TEXT.terms}
        </a>
        {LEGAL_CHECK_TEXT.between}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          {LEGAL_CHECK_TEXT.privacy}
        </a>
        {LEGAL_CHECK_TEXT.after}
      </label>
    </div>
  );
}
