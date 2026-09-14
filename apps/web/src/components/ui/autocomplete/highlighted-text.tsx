import type { ReactNode } from 'react';

/**
 * The typed characters, marked inside a label (**R43**). Case-insensitive, and
 * it marks *every* occurrence: underlining one `a` in "Vellore Star Auto" and
 * leaving the others plain reads as a rendering fault rather than a match.
 *
 * `<mark>` rather than a styled `<span>` because that is what the element is
 * for, and because a screen reader announces it. Text that does not contain the
 * search renders unmarked — the correct answer for a row matched on its town.
 */
export function HighlightedText({ text, match }: { text: string; match: string }): ReactNode {
  const needle = match.trim();
  if (needle.length === 0) return text;

  const parts: ReactNode[] = [];
  const haystack = text.toLowerCase();
  const lowered = needle.toLowerCase();

  let cursor = 0;
  let at = haystack.indexOf(lowered);

  while (at !== -1) {
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(
      <mark
        key={at}
        className="bg-transparent font-bold text-(--color-accent) underline [text-underline-offset:2px]"
      >
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    cursor = at + needle.length;
    at = haystack.indexOf(lowered, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}
