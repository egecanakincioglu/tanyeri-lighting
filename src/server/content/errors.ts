import { Prisma } from '../../generated/prisma/client.ts';

export class ContentNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = 'ContentNotFoundError';
  }
}

// The new order must list every existing item exactly once.
export class InvalidOrderError extends Error {
  constructor() {
    super('The new order must list every item exactly once');
    this.name = 'InvalidOrderError';
  }
}

// Prisma reports an update or delete of a missing row with code P2025.
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
