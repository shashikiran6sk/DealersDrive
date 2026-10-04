import { RetryButton } from '@/components/errors/retry-button';
import { ErrorState } from '@/components/ui/primitives';

export interface SectionErrorProps {
  title: string;
  message: string;
  className?: string;
}

export function SectionError({ title, message, className }: SectionErrorProps) {
  return (
    <div className={className}>
      <ErrorState
        title={title}
        message={message}
        action={<RetryButton variant="secondary" size="md" />}
      />
    </div>
  );
}
