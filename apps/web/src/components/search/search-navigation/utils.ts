import { cn } from '@/lib/cn';

export function resultsRegionClass(pending: boolean, className?: string): string {
  return cn(
    'min-w-0 transition-opacity duration-150',
    pending && 'opacity-60 delay-200',
    className,
  );
}

export function revealAnchor(id: string): void {
  const target = document.getElementById(id);
  if (target && target.getBoundingClientRect().top < 0) target.scrollIntoView({ block: 'start' });
}
