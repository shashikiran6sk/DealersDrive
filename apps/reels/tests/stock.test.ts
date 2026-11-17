import { describe, expect, it } from 'vitest';

import { stockFigure } from '../src/data/stock';

describe('stockFigure', () => {
  it('rounds ten or more cars down to a multiple of five, with a plus', () => {
    expect(stockFigure(11)).toEqual({ value: 10, plus: true });
    expect(stockFigure(19)).toEqual({ value: 15, plus: true });
    expect(stockFigure(47)).toEqual({ value: 45, plus: true });
  });

  it('shows an exact multiple of five without a plus', () => {
    expect(stockFigure(10)).toEqual({ value: 10, plus: false });
    expect(stockFigure(20)).toEqual({ value: 20, plus: false });
  });

  it('shows fewer than ten cars exactly', () => {
    expect(stockFigure(8)).toEqual({ value: 8, plus: false });
    expect(stockFigure(1)).toEqual({ value: 1, plus: false });
  });
});
