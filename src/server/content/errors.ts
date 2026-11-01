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

// "value" is used when the database does not say which unique value collided.
type TakenField = 'key' | 'code' | 'slug' | 'value';

// A value that has to be unique (a category key, a product code or slug) is already in use.
export class ValueTakenError extends Error {
  readonly field: TakenField;

  constructor(field: TakenField) {
    super(`The ${field} is already in use`);
    this.name = 'ValueTakenError';
    this.field = field;
  }
}

export class CategoryLimitError extends Error {
  constructor(limit: number) {
    super(`There can be at most ${limit} categories`);
    this.name = 'CategoryLimitError';
  }
}

// Products are not deleted or moved with their category: the category has to be emptied first.
export class CategoryNotEmptyError extends Error {
  constructor() {
    super('The category still has products');
    this.name = 'CategoryNotEmptyError';
  }
}

const UNIQUE_COLUMNS = [
  ['slug', 'slug'],
  ['oldSlug', 'slug'],
  ['code', 'code'],
  ['key', 'key'],
] as const;

// The names a unique violation gives for the constraint: `meta.target` (column names, or the index name) and, with
// the driver adapter, `meta.driverAdapterError.cause.constraint` (`fields` or `index`).
function constraintNames(meta: Record<string, unknown> | undefined): string[] {
  const names: unknown[] = [meta?.['target']];
  const cause = (meta?.['driverAdapterError'] as { cause?: { constraint?: Record<string, unknown> } } | undefined)
    ?.cause;
  names.push(cause?.constraint?.['fields'], cause?.constraint?.['index']);
  return names.flat().filter((name): name is string => typeof name === 'string');
}

// A column name (`slug`) or an index name (`product_slug_key`) matches the column it ends with.
function takenField(names: string[]): TakenField {
  for (const [column, field] of UNIQUE_COLUMNS) {
    if (names.some((name) => name === column || name.replace(/_key$/, '').endsWith(`_${column}`))) return field;
  }
  return 'value';
}

// Closes the race between the check for a free value and the write: the database's unique constraint has the last
// word, and its violation (P2002) becomes the same error as the check. Any other error comes back unchanged.
export function mapUniqueViolation(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return error;
  return new ValueTakenError(takenField(constraintNames(error.meta)));
}

// Prisma reports an update or delete of a missing row with code P2025.
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}
