import { getDb } from '../db.ts';

export type MissingContent = {
  productsWithoutDescription: number;
  productsWithoutTechnicalValue: number;
  draftPosts: number;
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
    // A catalog without a cover has nothing to describe.
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
