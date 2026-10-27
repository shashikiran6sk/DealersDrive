import type { RequestHandler } from 'express';

import { customerPrincipal, dealerPrincipal } from '../../middleware/auth.js';
import { legalEnabled, type LegalService } from './legal.service.js';

export function customerLegalGate(service: LegalService): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!legalEnabled()) {
        next();
        return;
      }
      await service.require(customerPrincipal(req), 'CUSTOMER');
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function dealerLegalGate(service: LegalService): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!legalEnabled()) {
        next();
        return;
      }
      const person = dealerPrincipal(req);
      const preparing = ['DRAFT', 'PENDING_APPROVAL'].includes(person.dealerStatus);
      const draftPath =
        req.path === '/' ||
        req.path === '/onboarding' ||
        req.path === '/completeness' ||
        req.path === '/submit' ||
        /^\/documents(?:\/|$)/.test(req.path);
      if (!(preparing && draftPath)) await service.require(person, 'DEALER');
      next();
    } catch (error) {
      next(error);
    }
  };
}
