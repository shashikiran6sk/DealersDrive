import {
  NativeCustomerCredential,
  type NativeCustomerSignUp,
} from '@dealers-drive/contracts/native-auth';
import { ApiError } from '../../services/api';
import type { AuthApi } from './auth-api';
import { AUTH_TEXT } from './auth.constants';
import type { CredentialStorage } from './credential-storage';
import { PendingActions } from './pending-action';

type Credential = NativeCustomerSignUp['credential'];
type Customer = NativeCustomerSignUp['customer'];
export interface SessionSnapshot {
  status: 'restoring' | 'guest' | 'authenticated' | 'unavailable';
  customer: Customer | null;
  error: string | null;
}
export class SessionManager {
  readonly pending = new PendingActions();
  private snapshot: SessionSnapshot = { status: 'restoring', customer: null, error: null };
  private credential: Credential | null = null;
  private retained: Credential | null = null;
  private epoch = 0;
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();
  private restoring: Promise<void> | null = null;
  private authenticationGeneration: number | null = null;
  private credentialBeforeAuthentication: Credential | null = null;
  private writingGeneration: number | null = null;
  constructor(
    private storage: CredentialStorage,
    private api: Pick<AuthApi, 'me' | 'logout'>,
    private clearPrivate: () => void = () => undefined,
  ) {}
  getSnapshot = (): SessionSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  expiresAt(): string | null {
    return this.snapshot.status === 'authenticated' ? (this.credential?.expiresAt ?? null) : null;
  }
  token(): string | null {
    return this.snapshot.status === 'authenticated' &&
      this.credential &&
      Date.parse(this.credential.expiresAt) > Date.now()
      ? this.credential.token
      : null;
  }
  beginAuthentication(): number {
    this.credentialBeforeAuthentication = this.credential;
    this.authenticationGeneration = ++this.epoch;
    if (this.snapshot.status === 'restoring')
      this.publish({ status: 'guest', customer: null, error: null });
    return this.authenticationGeneration;
  }
  cancelAuthentication(generation: number): void {
    if (this.epoch === generation) {
      this.authenticationGeneration = null;
      this.epoch++;
      this.pending.clear();
      if (this.writingGeneration === generation) {
        const previous = this.credentialBeforeAuthentication;
        void this.serialize(() =>
          previous ? this.storage.write(JSON.stringify(previous)) : this.storage.remove(),
        ).catch(() => undefined);
      }
      this.credentialBeforeAuthentication = null;
    }
  }
  private publish(snapshot: SessionSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  private serialize(action: () => Promise<void>): Promise<void> {
    const next = this.queue.catch(() => undefined).then(action);
    this.queue = next;
    return next;
  }
  async accept(
    generation: number,
    credential: Credential,
    customer: Customer,
    previousCustomerId: string | null = this.snapshot.customer?.id ?? null,
  ): Promise<boolean> {
    if (generation !== this.epoch) return false;
    if (Date.parse(credential.expiresAt) <= Date.now())
      throw new ApiError('SESSION_EXPIRED', AUTH_TEXT.expired, 401);
    this.writingGeneration = generation;
    try {
      await this.serialize(async () => {
        if (generation === this.epoch) await this.storage.write(JSON.stringify(credential));
      });
    } catch {
      try {
        await this.serialize(() => this.storage.remove());
      } catch {
        this.publish({ status: 'unavailable', customer: null, error: AUTH_TEXT.storage });
      }
      throw new Error(AUTH_TEXT.storage);
    } finally {
      if (this.writingGeneration === generation) this.writingGeneration = null;
    }
    if (generation !== this.epoch) return false;
    if (previousCustomerId !== customer.id) this.clearPrivate();
    this.credential = credential;
    this.retained = null;
    this.authenticationGeneration = null;
    this.pending.bind(customer.id);
    this.publish({ status: 'authenticated', customer, error: null });
    return true;
  }
  restore(): Promise<void> {
    if (this.authenticationGeneration !== null) return Promise.resolve();
    if (this.restoring) return this.restoring;
    const generation = ++this.epoch;
    const previous = this.snapshot;
    const silent = previous.status === 'authenticated';
    if (!silent) this.publish({ status: 'restoring', customer: null, error: null });
    this.restoring = this.load(generation, silent, previous.customer?.id ?? null).finally(() => {
      this.restoring = null;
    });
    return this.restoring;
  }
  private async load(
    generation: number,
    silent: boolean,
    previousCustomerId: string | null,
  ): Promise<void> {
    try {
      const raw = await this.storage.read();
      if (generation !== this.epoch) return;
      let value: unknown;
      try {
        value = raw ? JSON.parse(raw) : null;
      } catch {
        value = null;
      }
      const parsed = NativeCustomerCredential.safeParse(value);
      if (!parsed.success || Date.parse(parsed.data.expiresAt) <= Date.now()) {
        await this.invalidate(generation);
        return;
      }
      this.retained = parsed.data;
      const result = await this.api.me(parsed.data.token);
      if (generation !== this.epoch) return;
      await this.accept(
        generation,
        { token: parsed.data.token, expiresAt: result.expiresAt },
        result.customer,
        previousCustomerId,
      );
    } catch (error) {
      if (generation !== this.epoch) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await this.invalidate(generation);
        return;
      }
      if (silent) return;
      this.credential = null;
      this.clearPrivate();
      this.publish({ status: 'unavailable', customer: null, error: AUTH_TEXT.restoreError });
    }
  }
  async invalidate(generation = ++this.epoch): Promise<void> {
    if (generation !== this.epoch) return;
    this.credential = null;
    this.retained = null;
    this.authenticationGeneration = null;
    this.pending.clear();
    this.clearPrivate();
    this.publish({ status: 'guest', customer: null, error: null });
    try {
      await this.serialize(async () => {
        await this.storage.remove();
      });
    } catch {
      if (generation === this.epoch)
        this.publish({ status: 'unavailable', customer: null, error: AUTH_TEXT.storage });
    }
  }
  async logout(): Promise<boolean> {
    const token = this.credential?.token ?? this.retained?.token;
    await this.invalidate();
    const locallyCleared = this.snapshot.status === 'guest';
    if (!token) return locallyCleared;
    try {
      await this.api.logout(token);
      return locallyCleared;
    } catch (error) {
      return locallyCleared && error instanceof ApiError && error.status === 401;
    }
  }
}
