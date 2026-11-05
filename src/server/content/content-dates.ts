import { getDb } from '../db.ts';
import type { PageKey } from './schemas.ts';

export const newest = (...dates: (Date | null | undefined)[]): Date | undefined =>
  dates.reduce<Date | undefined>((latest, date) => (date && (!latest || date > latest) ? date : latest), undefined);

// Page dates for the sitemap. The product list is dated by the caller.
export async function listContentDates(): Promise<Partial<Record<PageKey, Date>>> {
  const db = getDb();
  const [banner, boards, areas, featured, featuredProducts, services, projects, references, catalogs] =
    await Promise.all([
      db.homeBanner.aggregate({ _max: { updatedAt: true } }),
      db.promoBoard.aggregate({ _max: { updatedAt: true } }),
      db.applicationArea.aggregate({ _max: { updatedAt: true } }),
      db.featuredProduct.aggregate({ _max: { createdAt: true } }),
      db.product.aggregate({ where: { featured: { isNot: null } }, _max: { updatedAt: true } }),
      db.service.aggregate({ _max: { updatedAt: true } }),
      db.project.aggregate({ _max: { updatedAt: true } }),
      db.reference.aggregate({ _max: { updatedAt: true } }),
      db.catalog.aggregate({ _max: { updatedAt: true } }),
    ]);
  const dates = {
    home: newest(
      banner._max.updatedAt,
      boards._max.updatedAt,
      areas._max.updatedAt,
      featured._max.createdAt,
      featuredProducts._max.updatedAt,
    ),
    services: newest(services._max.updatedAt),
    projects: newest(projects._max.updatedAt),
    references: newest(references._max.updatedAt),
    catalogs: newest(catalogs._max.updatedAt),
  };
  return Object.fromEntries(Object.entries(dates).filter(([, date]) => date)) as Partial<Record<PageKey, Date>>;
}
