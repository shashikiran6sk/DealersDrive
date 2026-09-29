import type { SupportIconName } from './support-page.types';

const PATHS: Record<SupportIconName, string> = {
  customer: 'M4 6h16v12H4z M4 7l8 6 8-6',
  dealer: 'M3 10l9-6 9 6 M5 9v10h14V9 M10 19v-5h4v5',
  chat: 'M4 5h16v11H9l-5 4z',
};

export function SupportIcon({ name }: { name: SupportIconName }) {
  return (
    <span className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-(--color-neutral-100)">
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d={PATHS[name]} />
      </svg>
    </span>
  );
}
