import type { Router } from 'express';
import type { LegalPublicationService } from '../legal-publication.js';

export function getPublication(router: Router, service: LegalPublicationService): void {
  router.get('/legal/publication', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    void service
      .current()
      .then((body) => res.json(body))
      .catch(next);
  });
}
