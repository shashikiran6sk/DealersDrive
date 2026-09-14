interface Msg91Configuration {
  widgetId: string;
  tokenAuth: string;
  exposeMethods: true;
  captchaRenderId?: string;
  success: (data: unknown) => void;
  failure: (error: unknown) => void;
}

type Msg91Callback = (data: unknown) => void;

declare global {
  interface Window {
    initSendOTP?: (configuration: Msg91Configuration) => void;
    sendOtp?: (identifier: string, success?: Msg91Callback, failure?: Msg91Callback) => void;
    retryOtp?: (
      channel: string | null,
      success?: Msg91Callback,
      failure?: Msg91Callback,
      reqId?: string,
    ) => void;
    verifyOtp?: (
      otp: string,
      success?: Msg91Callback,
      failure?: Msg91Callback,
      reqId?: string,
    ) => void;
  }
}

type Msg91Window = Window;

const SCRIPT_SRC = 'https://verify.msg91.com/otp-provider.js';
const SCRIPT_ID = 'msg91-otp-provider';

const READY_TIMEOUT_MS = 15_000;

const CALL_TIMEOUT_MS = 20_000;

let loading: Promise<Msg91Window> | null = null;

export function loadMsg91Widget(config: {
  widgetId: string;
  tokenAuth: string;
  captchaRenderId?: string;
}): Promise<void> {
  loading ??= new Promise<Msg91Window>((resolve, reject) => {
    const target = window;

    const initialise = (): void => {
      if (!target.initSendOTP) {
        fail(new Error('The verification service loaded without initSendOTP.'));
        return;
      }

      target.initSendOTP({
        widgetId: config.widgetId,
        tokenAuth: config.tokenAuth,
        exposeMethods: true,
        ...(config.captchaRenderId ? { captchaRenderId: config.captchaRenderId } : {}),
        success: () => undefined,
        failure: () => undefined,
      });

      whenExposed(target).then(
        () => {
          resolve(target);
        },
        (error: unknown) => {
          fail(error);
        },
      );
    };

    const fail = (error: unknown): void => {
      loading = null;
      reject(
        error instanceof Error ? error : new Error('The verification service could not be loaded.'),
      );
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      waitFor(() => typeof target.initSendOTP === 'function', READY_TIMEOUT_MS).then(
        initialise,
        () => {
          fail(new Error('The verification service could not be loaded.'));
        },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = initialise;
    script.onerror = () => {
      script.remove();
      fail(new Error('The verification service could not be loaded.'));
    };
    document.head.append(script);
  });

  return loading.then(() => undefined);
}

function whenExposed(target: Msg91Window): Promise<void> {
  return waitFor(
    () =>
      typeof target.sendOtp === 'function' &&
      typeof target.retryOtp === 'function' &&
      typeof target.verifyOtp === 'function',
    READY_TIMEOUT_MS,
  ).catch(() => {
    throw new Error(
      'The verification service did not finish starting up. Check that this domain is ' +
        'allow-listed on the MSG91 widget.',
    );
  });
}

function waitFor(ready: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (ready()) {
      resolve();
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (ready()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        reject(new Error('timed out'));
      }
    }, 50);
  });
}

export function sendMsg91Otp(identifier: string): Promise<void> {
  return call('sendOtp', (target, resolve, reject) => {
    target.sendOtp?.(
      identifier,
      () => {
        resolve(undefined);
      },
      reject,
    );
  });
}

export function retryMsg91Otp(identifier: string): Promise<void> {
  return call<void>('retryOtp', (target, resolve, reject) => {
    target.retryOtp?.(
      null,
      () => {
        resolve(undefined);
      },
      reject,
    );
  }).catch(async (error: unknown) => {
    console.warn(
      '[msg91] retryOtp was refused; resending instead. Configure a retry channel on the widget ' +
        'to use the provider’s own resend.',
      error,
    );
    await sendMsg91Otp(identifier);
  });
}

export function verifyMsg91Otp(code: string): Promise<string> {
  return call<string>('verifyOtp', (target, resolve, reject) => {
    target.verifyOtp?.(
      code,
      (data) => {
        const token = accessTokenOf(data);
        if (token) resolve(token);
        else reject(new Error('The verification service returned no access token.'));
      },
      reject,
    );
  });
}

function call<T>(
  method: 'sendOtp' | 'retryOtp' | 'verifyOtp',
  run: (target: Msg91Window, resolve: (value: T) => void, reject: (error: unknown) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const target = window;

    if (typeof target.initSendOTP !== 'function') {
      reject(new Error('The verification service is not loaded.'));
      return;
    }

    let done = false;
    const settle =
      <A>(act: (value: A) => void) =>
      (value: A) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        act(value);
      };

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(
        new Error(
          `The verification service did not respond to ${method}. It may be blocked on this ` +
            'page, or this domain may not be allow-listed on the MSG91 widget.',
        ),
      );
    }, CALL_TIMEOUT_MS);

    const ok = settle(resolve);
    const no = settle<unknown>((error) => {
      console.error(`[msg91] ${method} failed`, error);
      reject(
        error instanceof Error ? error : new Error(`The verification service refused ${method}.`),
      );
    });

    whenExposed(target).then(
      () => {
        if (typeof target[method] !== 'function') {
          no(new Error(`The verification service exposed no ${method}.`));
          return;
        }
        try {
          run(target, ok, no);
        } catch (error) {
          no(error);
        }
      },
      (error: unknown) => {
        no(error);
      },
    );
  });
}

const TOKEN_KEYS = ['message', 'accessToken', 'access-token', 'token', 'jwt'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function accessTokenOf(data: unknown): string | null {
  if (typeof data === 'string') return data.trim() || null;

  if (!isRecord(data)) return null;

  for (const key of TOKEN_KEYS) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function resetMsg91Widget(): void {
  loading = null;
}
