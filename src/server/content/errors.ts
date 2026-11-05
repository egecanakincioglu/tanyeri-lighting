import { Prisma } from '../../generated/prisma/client.ts';

export class ContentNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = 'ContentNotFoundError';
  }
}

export class InvalidOrderError extends Error {
  constructor() {
    super('The new order must list every item exactly once');
    this.name = 'InvalidOrderError';
  }
}

// "value" is used when the database does not say which value collided.
type TakenField = 'key' | 'code' | 'slug' | 'value';

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

// Constraint names: `meta.target`, and with the driver adapter `meta.driverAdapterError.cause.constraint`.
function constraintNames(meta: Record<string, unknown> | undefined): string[] {
  const names: unknown[] = [meta?.['target']];
  const cause = (meta?.['driverAdapterError'] as { cause?: { constraint?: Record<string, unknown> } } | undefined)
    ?.cause;
  names.push(cause?.constraint?.['fields'], cause?.constraint?.['index']);
  return names.flat().filter((name): name is string => typeof name === 'string');
}

// A column name or index name matches the column it ends with.
function takenField(names: string[]): TakenField {
  for (const [column, field] of UNIQUE_COLUMNS) {
    if (names.some((name) => name === column || name.replace(/_key$/, '').endsWith(`_${column}`))) return field;
  }
  return 'value';
}

// The unique constraint has the last word when two writers race; P2002 becomes the same error as the check.
export function mapUniqueViolation(error: unknown): unknown {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return error;
  return new ValueTakenError(takenField(constraintNames(error.meta)));
}

export class CatalogInUseError extends Error {
  constructor() {
    super('A promo board still links to the catalog');
    this.name = 'CatalogInUseError';
  }
}

// Prisma code P2025: update or delete of a missing row.
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

// Prisma code P2003: a write that breaks a foreign key.
export function isForeignKeyViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
}
