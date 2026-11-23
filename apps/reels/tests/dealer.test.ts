import { describe, expect, it } from 'vitest';

import { dealerLocation, dealerServices, serviceLabel } from '../src/data/dealer';

describe('dealerLocation', () => {
  it('translates a known town and state', () => {
    expect(dealerLocation('Vellore', 'Tamil Nadu')).toEqual({
      en: 'Vellore, Tamil Nadu',
      ta: 'வேலூர், தமிழ்நாடு',
    });
  });

  it('keeps English only for a town it does not know', () => {
    expect(dealerLocation('Pernambut', 'Tamil Nadu')).toEqual({
      en: 'Pernambut, Tamil Nadu',
      ta: null,
    });
  });
});

describe('serviceLabel', () => {
  it('tidies and translates the services dealers type', () => {
    expect(serviceLabel('Rc Transfer')).toEqual({ en: 'RC Transfer', ta: 'RC மாற்றம்' });
    expect(serviceLabel('Workshop( Wash and Polish)')).toEqual({
      en: 'Workshop',
      ta: 'வொர்க்ஷாப்',
    });
  });

  it('keeps an unknown service in the dealer’s words, English only', () => {
    expect(serviceLabel('  Doorstep   test drive ')).toEqual({
      en: 'Doorstep test drive',
      ta: null,
    });
  });
});

describe('dealerServices', () => {
  it('drops blanks and duplicates and caps the list', () => {
    const services = dealerServices(['Loan', ' ', 'loan', 'Buying', 'Selling', 'Exchange'], 3);
    expect(services.map((service) => service.en)).toEqual(['Loan', 'Buying', 'Selling']);
  });
});
