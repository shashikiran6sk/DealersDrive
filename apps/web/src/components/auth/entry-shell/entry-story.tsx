import { ENTRY_STORY_TEXT } from './entry-shell.constants';

export function EntryStory() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-[22px] bg-(--color-bg) px-10 py-14 xl:px-[54px]">
      <div className="eyebrow">{ENTRY_STORY_TEXT.eyebrow}</div>
      <p
        className="font-heading text-[36px] leading-[1.08] font-extrabold tracking-[-0.04em] xl:text-[42px]"
        aria-hidden="true"
      >
        {ENTRY_STORY_TEXT.titleLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
      <p className="sr-only">{ENTRY_STORY_TEXT.titleLines.join(' ')}</p>
      <p className="max-w-[43ch] text-[14px] leading-[1.8] ink-muted">{ENTRY_STORY_TEXT.body}</p>

      <ul
        aria-label={ENTRY_STORY_TEXT.proofLabel}
        className="m-0 flex list-none flex-col gap-0 rounded-[22px] bg-white p-0 px-6 shadow-lg"
      >
        {ENTRY_STORY_TEXT.proofs.map((proof) => (
          <li
            key={proof.title}
            className="flex items-start gap-[12px] border-b border-(--color-divider) py-[18px] last:border-b-0"
          >
            <span
              aria-hidden="true"
              className="grid h-[26px] w-[26px] flex-none place-items-center rounded-[8px] bg-(--color-neutral-100) text-[12px] font-extrabold"
            >
              {ENTRY_STORY_TEXT.check}
            </span>
            <span className="flex flex-col">
              <strong className="text-[14px] font-extrabold">{proof.title}</strong>
              <span className="text-[13px] ink-muted">{proof.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
