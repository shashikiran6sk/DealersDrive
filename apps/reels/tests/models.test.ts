import { describe, expect, it } from 'vitest';

import { matchesTerm, modelKey, words, type ModelName } from '../src/data/models';

const MODELS: ModelName[] = [
  { brand: 'Maruti Suzuki', model: 'Swift' },
  { brand: 'Maruti Suzuki', model: 'Swift Dzire' },
  { brand: 'Maruti Suzuki', model: 'Eeco' },
  { brand: 'Honda', model: 'BR-V' },
];

describe('words', () => {
  it('lowercases and splits on anything that is not a letter or digit', () => {
    expect(words('Honda BR-V  i20 Asta(o)')).toEqual(['honda', 'br', 'v', 'i20', 'asta', 'o']);
  });
});

describe('modelKey', () => {
  it('takes the longest brand and model the title starts with', () => {
    expect(modelKey('Maruti Suzuki Swift Dzire ZDI', MODELS)).toBe('maruti suzuki swift dzire');
    expect(modelKey('Maruti Suzuki Swift VDI', MODELS)).toBe('maruti suzuki swift');
    expect(modelKey('Honda BR-V', MODELS)).toBe('honda br v');
  });

  it('falls back to the whole title when no model is known', () => {
    expect(modelKey('Toyota Innova', MODELS)).toBe('toyota innova');
    expect(modelKey('Toyota Innova', [])).toBe('toyota innova');
  });
});

describe('matchesTerm', () => {
  it('matches a name from the start of any word, ignoring spacing and punctuation', () => {
    expect(matchesTerm('Honda BR-V', 'brv')).toBe(true);
    expect(matchesTerm('Hyundai i10 Grand Magna', 'i10')).toBe(true);
    expect(matchesTerm('Nissan Terrano', 'nissan')).toBe(true);
    expect(matchesTerm('Maruti Suzuki Swift Dzire ZDI', 'swift dzire')).toBe(true);
  });

  it('does not match inside a word, or an empty name', () => {
    expect(matchesTerm('Hyundai Creta', 'ai')).toBe(false);
    expect(matchesTerm('Hyundai Creta', ' - ')).toBe(false);
  });
});
