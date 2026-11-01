import { InvalidOrderError } from './errors.ts';

// The position of an item added to the end of a list whose largest position is `max` (null for an empty list).
export function nextPosition(max: number | null): number {
  return (max ?? -1) + 1;
}

// `order` has to be the complete list of `existing` ids, each exactly once; anything else is rejected.
export function assertCompleteOrder(order: string[], existing: string[]): void {
  const known = new Set(existing);
  if (order.length !== known.size || new Set(order).size !== order.length || !order.every((id) => known.has(id))) {
    throw new InvalidOrderError();
  }
}
