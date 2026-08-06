import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatAmount, parseAmount, sum } from './money.ts';

describe('parseAmount', () => {
  it('parses whole amounts', () => {
    assert.equal(parseAmount('12'), 1200);
  });

  it('parses two decimal places', () => {
    assert.equal(parseAmount('12.30'), 1230);
  });

  it('parses one decimal place as tenths', () => {
    assert.equal(parseAmount('12.3'), 1230);
  });

  it('parses negative amounts', () => {
    assert.equal(parseAmount('-4.05'), -405);
  });

  it('rejects three decimal places', () => {
    assert.throws(() => parseAmount('1.234'), RangeError);
  });

  it('rejects non-numeric input', () => {
    assert.throws(() => parseAmount('twelve'), RangeError);
  });
});

describe('formatAmount', () => {
  it('pads cents', () => {
    assert.equal(formatAmount(1205), '12.05');
  });

  it('handles zero', () => {
    assert.equal(formatAmount(0), '0.00');
  });

  it('handles negatives', () => {
    assert.equal(formatAmount(-405), '-4.05');
  });
});

describe('sum', () => {
  it('does not drift the way floats do', () => {
    const amounts = Array.from({ length: 10 }, () => parseAmount('0.10'));
    assert.equal(sum(amounts), 100);
    assert.equal(formatAmount(sum(amounts)), '1.00');
  });
});
