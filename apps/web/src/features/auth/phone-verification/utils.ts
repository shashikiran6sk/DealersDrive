export { identifierOf } from '@/lib/phone-otp';

export function countdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function isServiceFailure(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith('The verification service');
}
