import { getDb } from '../db.ts';

export type MissingContent = {
  productsWithoutDescription: number;
  productsWithoutTechnicalValue: number;
  draftPosts: number;
  // Rows whose picture has no description in one of the two languages, per table.
  imagesWithoutDescription: {
    services: number;
    applicationAreas: number;
    references: number;
    promoBoards: number;
    catalogs: number;
    homeBanner: number;
  };
};

const noAlt = { OR: [{ imageAltTr: '' }, { imageAltEn: '' }] };

// Cheap counts for the panel home: what is still empty and worth filling in. Callers check the session first.
export async function getMissingContent(): Promise<MissingContent> {
  const db = getDb();
  const [
    productsWithoutDescription,
    productsWithoutTechnicalValue,
    draftPosts,
    services,
    applicationAreas,
    references,
    promoBoards,
    catalogs,
    homeBanner,
  ] = await Promise.all([
    db.product.count({ where: { OR: [{ descriptionTr: '' }, { descriptionEn: '' }] } }),
    db.product.count({ where: { OR: [{ luminousFlux: '' }, { colorTemperature: '' }, { cri: '' }, { ip: '' }] } }),
    db.blogPost.count({ where: { publishedAt: null } }),
    db.service.count({ where: noAlt }),
    db.applicationArea.count({ where: noAlt }),
    db.reference.count({ where: noAlt }),
    db.promoBoard.count({ where: noAlt }),
    // A catalog without a cover picture has nothing to describe.
    db.catalog.count({ where: { AND: [noAlt, { NOT: { coverImageUrl: '' } }] } }),
    db.homeBanner.count({ where: noAlt }),
  ]);
  return {
    productsWithoutDescription,
    productsWithoutTechnicalValue,
    draftPosts,
    imagesWithoutDescription: { services, applicationAreas, references, promoBoards, catalogs, homeBanner },
  };
}
