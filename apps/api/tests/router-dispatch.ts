import type { Request, Response, Router } from 'express';

export function dispatchRoute(router: Router, method: string, url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = {
      method,
      url,
      originalUrl: url,
      baseUrl: '',
      path: url.split('?')[0],
      query: {},
      body: {},
      params: {},
      headers: {},
      get: () => undefined,
    } as unknown as Request;

    const terminal = new Set(['end', 'json', 'send', 'sendStatus', 'redirect']);
    const res = new Proxy({} as Response, {
      get: (_target, key) => {
        if (key === 'headersSent') return false;
        return () => {
          if (terminal.has(String(key))) resolve(true);
          return res;
        };
      },
    });

    router(req, res, (error?: unknown) => resolve(error !== undefined && error !== null));
  });
}
