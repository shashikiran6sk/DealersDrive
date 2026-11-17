import { describe, expect, it } from 'vitest';

import { carSpecs, titleWithoutYear } from '../src/data/specs';

describe('carSpecs', () => {
  it('keeps distance, fuel and gearbox in both languages and drops the town', () => {
    expect(carSpecs('93,304 km · Petrol · Automatic · Vellore')).toEqual([
      { en: '93,304 km', ta: '93,304 கி.மீ' },
      { en: 'Petrol', ta: 'பெட்ரோல்' },
      { en: 'Automatic', ta: 'ஆட்டோமேட்டிக்' },
    ]);
  });

  it('drops parts it cannot name', () => {
    expect(carSpecs('1,42,072 km ·  · Hydrogen · Manual')).toEqual([
      { en: '1,42,072 km', ta: '1,42,072 கி.மீ' },
      { en: 'Manual', ta: 'மேனுவல்' },
    ]);
  });
});

describe('titleWithoutYear', () => {
  it('strips the leading model year', () => {
    expect(titleWithoutYear('2022 Tata Nexon XZA+ S', 2022)).toBe('Tata Nexon XZA+ S');
  });

  it('leaves a title alone when the year is absent or elsewhere', () => {
    expect(titleWithoutYear('Tata Nexon', null)).toBe('Tata Nexon');
    expect(titleWithoutYear('Tata Nexon 2022', 2022)).toBe('Tata Nexon 2022');
  });
});
