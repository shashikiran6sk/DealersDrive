import type { Router } from 'express';
import type { LegalService } from '../legal.service.js';
export type LegalRoute = (router: Router, service: LegalService) => void;
