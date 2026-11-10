import { Router } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { dispatchRoute } from '../router-dispatch.js';

describe('route dispatch completion', () => {
  it('waits for an unmatched nested router to finish after the old 20 ms window', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const router = Router();
      const child = Router();
      child.use((_req, _res, next) => {
        setTimeout(next, 50);
      });
      router.use('/dealer', child);
      const completed = vi.fn();
      const result = dispatchRoute(router, 'POST', '/dealer/media/presign');
      void result.then(completed);

      await vi.advanceTimersByTimeAsync(21);
      expect(completed).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(29);
      await expect(result).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits for an asynchronous response through a nested router', async () => {
    const router = Router();
    const child = Router();
    child.get('/profile', async (_req, res) => {
      await Promise.resolve();
      res.status(200).json({ name: 'Dealer' });
    });
    router.use('/dealer', child);

    await expect(dispatchRoute(router, 'GET', '/dealer/profile')).resolves.toBe(true);
  });

  it('counts a handler rejecting its input as reached', async () => {
    const router = Router();
    router.post('/upload', async () => {
      await Promise.resolve();
      throw new Error('Invalid upload');
    });

    await expect(dispatchRoute(router, 'POST', '/upload')).resolves.toBe(true);
  });

  it('does not treat response headers as a completed response', async () => {
    const router = Router();
    router.use((_req, res, next) => {
      res.setHeader('X-Test', 'value');
      next();
    });

    await expect(dispatchRoute(router, 'GET', '/missing')).resolves.toBe(false);
  });

  it.each(['end', 'send', 'sendStatus', 'redirect'] as const)(
    'recognizes a response completed with %s',
    async (method) => {
      const router = Router();
      router.get('/done', (_req, res) => {
        if (method === 'sendStatus') res.sendStatus(204);
        else if (method === 'redirect') res.redirect('/next');
        else res[method]();
      });

      await expect(dispatchRoute(router, 'GET', '/done')).resolves.toBe(true);
    },
  );
});
