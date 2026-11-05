import { InvalidOrderError } from './errors.ts';

export function nextPosition(max: number | null): number {
  return (max ?? -1) + 1;
}

// `order` must list every existing id exactly once.
export function assertCompleteOrder(order: string[], existing: string[]): void {
  const known = new Set(existing);
  if (order.length !== known.size || new Set(order).size !== order.length || !order.every((id) => known.has(id))) {
    throw new InvalidOrderError();
  }
}
