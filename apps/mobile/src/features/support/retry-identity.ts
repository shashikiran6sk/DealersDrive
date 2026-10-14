import { randomUUID } from 'expo-crypto';
import { Uuid } from '@dealers-drive/contracts/common';

export class RetryIdentity {
  private current: { signature: string; id: string } | null = null;
  constructor(private readonly generate: () => string = randomUUID) {}
  forPayload(payload: unknown): string {
    const signature = JSON.stringify(payload);
    if (this.current?.signature === signature) return this.current.id;
    const id = Uuid.parse(this.generate());
    this.current = { signature, id };
    return id;
  }
  clear(): void {
    this.current = null;
  }
}
