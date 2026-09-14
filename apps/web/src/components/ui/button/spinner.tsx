export function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle cx="7" cy="7" r="5.5" opacity="0.25" />
      <path d="M12.5 7A5.5 5.5 0 0 0 7 1.5" strokeLinecap="round" />
    </svg>
  );
}
