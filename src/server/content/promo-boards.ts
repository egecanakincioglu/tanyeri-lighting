import type { Prisma } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { ContentNotFoundError, isForeignKeyViolation, isRecordNotFound } from './errors.ts';
import { assertCompleteOrder, nextPosition } from './order.ts';
import { idListSchema, idSchema, type PromoBoard, promoBoardSchema, type PromoBoardInput } from './schemas.ts';

const withCatalog = {
  catalog: { select: { nameTr: true, nameEn: true, pdfUrl: true } },
} satisfies Prisma.PromoBoardInclude;

type PromoBoardRow = Prisma.PromoBoardGetPayload<{ include: typeof withCatalog }>;

function fromRow(row: PromoBoardRow): PromoBoard {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    imageAlt: fromColumns('imageAlt', row),
    title: fromColumns('title', row),
    subtitle: fromColumns('subtitle', row),
    catalogId: row.catalogId,
    catalogName: fromColumns('name', row.catalog),
    catalogPdfUrl: row.catalog.pdfUrl,
  };
}

function toColumnsOf(board: PromoBoardInput) {
  return {
    imageUrl: board.imageUrl,
    ...toColumns('imageAlt', board.imageAlt),
    ...toColumns('title', board.title),
    ...toColumns('subtitle', board.subtitle),
    catalogId: board.catalogId,
  };
}

export async function listPromoBoards(): Promise<PromoBoard[]> {
  const rows = await getDb().promoBoard.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: withCatalog,
  });
  return rows.map(fromRow);
}

// The new board goes to the end of the list. The catalog has to exist: the foreign key is the check, so a catalog
// deleted at the same moment cannot slip through.
export async function createPromoBoard(input: unknown): Promise<PromoBoard> {
  assertWritable();
  const columns = toColumnsOf(promoBoardSchema.parse(input));
  try {
    const row = await getDb().$transaction(async (tx) => {
      const last = await tx.promoBoard.aggregate({ _max: { sortOrder: true } });
      return tx.promoBoard.create({
        data: { ...columns, sortOrder: nextPosition(last._max.sortOrder) },
        include: withCatalog,
      });
    });
    return fromRow(row);
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new ContentNotFoundError('Catalog');
    throw error;
  }
}

export async function updatePromoBoard(id: unknown, input: unknown): Promise<PromoBoard> {
  assertWritable();
  const boardId = idSchema.parse(id);
  const columns = toColumnsOf(promoBoardSchema.parse(input));
  try {
    return fromRow(await getDb().promoBoard.update({ where: { id: boardId }, data: columns, include: withCatalog }));
  } catch (error) {
    if (isRecordNotFound(error)) throw new ContentNotFoundError('Promo board');
    if (isForeignKeyViolation(error)) throw new ContentNotFoundError('Catalog');
    throw error;
  }
}

export async function deletePromoBoard(id: unknown): Promise<void> {
  assertWritable();
  const result = await getDb().promoBoard.deleteMany({ where: { id: idSchema.parse(id) } });
  if (result.count === 0) throw new ContentNotFoundError('Promo board');
}

// `ids` is the complete list in its new order; a missing, extra or repeated id changes nothing.
export async function reorderPromoBoards(ids: unknown): Promise<void> {
  assertWritable();
  const order = idListSchema.parse(ids);
  await getDb().$transaction(async (tx) => {
    assertCompleteOrder(
      order,
      (await tx.promoBoard.findMany({ select: { id: true } })).map((board) => board.id),
    );
    for (const [sortOrder, id] of order.entries()) {
      await tx.promoBoard.update({ where: { id }, data: { sortOrder } });
    }
  });
}
