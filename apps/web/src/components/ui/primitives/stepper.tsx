import { cn } from '@/lib/cn';

export interface StepperProps {
  steps: readonly string[];
  current: number;
  className?: string;
}

/** DESIGN-SPEC §2.16 — onboarding and the add-vehicle wizard share it. */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn('flex gap-[6px]', className)}>
      {steps.map((label, index) => (
        <li key={label} className="flex-1">
          <div
            className="h-[3px]"
            style={{
              background: index <= current ? 'var(--color-accent)' : 'var(--color-neutral-300)',
            }}
          />
          <div
            className="mt-[7px] text-[11px]"
            style={{
              color:
                index <= current
                  ? 'var(--color-accent-700)'
                  : 'color-mix(in srgb, var(--color-ink) 45%, transparent)',
            }}
          >
            {label}
          </div>
        </li>
      ))}
    </ol>
  );
}
