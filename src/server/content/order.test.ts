// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { InvalidOrderError } from './errors.ts';
import { assertCompleteOrder, nextPosition } from './order.ts';

describe('nextPosition', () => {
  it('starts at 0 for an empty list and continues after the largest position', () => {
    expect(nextPosition(null)).toBe(0);
    expect(nextPosition(0)).toBe(1);
    expect(nextPosition(6)).toBe(7);
  });
});

describe('assertCompleteOrder', () => {
  it('accepts every permutation of the existing ids and an empty list for an empty list', () => {
    expect(() => assertCompleteOrder(['b', 'a', 'c'], ['a', 'b', 'c'])).not.toThrow();
    expect(() => assertCompleteOrder([], [])).not.toThrow();
  });

  it.each([
    ['an id that is left out', ['a', 'b']],
    ['an unknown id', ['a', 'b', 'x']],
    ['a repeated id', ['a', 'a', 'b']],
    ['an extra id', ['a', 'b', 'c', 'd']],
  ])('rejects %s', (_, order) => {
    expect(() => assertCompleteOrder(order, ['a', 'b', 'c'])).toThrow(InvalidOrderError);
  });
});
