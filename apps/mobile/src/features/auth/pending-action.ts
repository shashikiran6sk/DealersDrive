export type ProtectedIntent =
  { kind: 'save'; slug: string } | { kind: 'enquiry'; slug: string } | { kind: 'saved' };
export interface PendingAction {
  id: number;
  intent: ProtectedIntent;
  ownerId: string | null;
}

export class PendingActions {
  private current: PendingAction | null = null;
  private sequence = 0;
  request(intent: ProtectedIntent): PendingAction {
    const action = { id: ++this.sequence, intent, ownerId: null };
    this.current = action;
    return action;
  }
  bind(userId: string): void {
    if (this.current?.ownerId && this.current.ownerId !== userId) this.clear();
    else if (this.current) this.current = { ...this.current, ownerId: userId };
  }
  peek(): PendingAction | null {
    return this.current;
  }
  consume(id: number, userId: string): ProtectedIntent | null {
    if (!this.current || this.current.id !== id || this.current.ownerId !== userId) return null;
    const intent = this.current.intent;
    this.clear();
    return intent;
  }
  clear(): void {
    this.current = null;
  }
}
