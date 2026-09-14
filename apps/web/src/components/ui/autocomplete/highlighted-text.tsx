import type { ReactNode } from 'react';

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
