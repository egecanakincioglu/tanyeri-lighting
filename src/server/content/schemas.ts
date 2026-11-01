import { z } from 'zod';
import { type Bilingual, bilingual, optionalBilingual } from './bilingual.ts';
import { isValidPhone } from './phone.ts';

// The input rules of the content services. Lengths are hard limits for storage and layout; search-engine length
// advice for titles and descriptions is shorter and belongs to the admin form.

const MAX_URL_LENGTH = 2048;

// https only: a stored address ends up in links and in structured data.
const httpsUrl = z
  .url({ protocol: /^https$/ })
  .trim()
  .max(MAX_URL_LENGTH);

export const siteSettingsSchema = z.object({
  siteName: bilingual(100),
  // A Blob address from the storage module, or none.
  logoUrl: httpsUrl.nullable(),
  phone: z.string().trim().max(30).refine(isValidPhone, 'Enter a phone number of 7 to 20 digits'),
  email: z.string().trim().pipe(z.email().max(254)),
  address: bilingual(300),
  workingHours: bilingual(200),
  serviceArea: bilingual(200),
  languages: bilingual(100),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const socialLinkSchema = z.object({
  platform: z.string().trim().min(1).max(40),
  label: bilingual(60),
  url: httpsUrl,
});

export type SocialLinkInput = z.infer<typeof socialLinkSchema>;
export type SocialLink = SocialLinkInput & { id: string };

export const socialLinkIdSchema = z.string().min(1).max(64);
export const socialLinkOrderSchema = z.array(socialLinkIdSchema);

// The public pages that have a title and a description of their own.
export const PAGE_KEYS = [
  'home',
  'products',
  'catalogs',
  'services',
  'projects',
  'references',
  'about',
  'contact',
  'privacy',
  'terms',
] as const;

export const pageKeySchema = z.enum(PAGE_KEYS);
export type PageKey = z.infer<typeof pageKeySchema>;

export const pageMetadataSchema = z.object({
  title: bilingual(120),
  description: bilingual(320),
});

type PageMetadataInput = z.infer<typeof pageMetadataSchema>;
export type PageMetadata = PageMetadataInput & { updatedAt: Date };

export const LEGAL_PAGE_KEYS = ['privacy', 'terms'] as const;

export const legalPageKeySchema = z.enum(LEGAL_PAGE_KEYS);
export type LegalPageKey = z.infer<typeof legalPageKeySchema>;

export const legalPageSchema = z.object({
  title: bilingual(150),
  // Limited Markdown, stored as plain text and rendered by src/components/markdown-content.tsx.
  body: bilingual(50_000),
});

type LegalPageInput = z.infer<typeof legalPageSchema>;
export type LegalPage = LegalPageInput & { updatedAt: Date };

export const projectSchema = z.object({
  title: bilingual(150),
  // Limited Markdown, stored as plain text and rendered by src/components/markdown-content.tsx.
  description: bilingual(5000),
  // The two pictures of the before and after slider; Blob addresses from the storage module.
  beforeImageUrl: httpsUrl,
  afterImageUrl: httpsUrl,
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type Project = ProjectInput & { id: string };

export const projectIdSchema = z.string().min(1).max(64);
export const projectOrderSchema = z.array(projectIdSchema);

export const referenceSchema = z.object({
  imageUrl: httpsUrl,
  // A proper name, the same in both languages.
  name: z.string().trim().min(1).max(100),
  // What kind of work it was.
  title: bilingual(100),
  description: bilingual(500),
});

export type ReferenceInput = z.infer<typeof referenceSchema>;
export type Reference = ReferenceInput & { id: string };

export const referenceIdSchema = z.string().min(1).max(64);
export const referenceOrderSchema = z.array(referenceIdSchema);

// Ids are created by the database; any id the caller sends is checked for shape only.
export const idSchema = z.string().min(1).max(64);
export const idListSchema = z.array(idSchema);

const kebabCase = (maxLength: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens');

export const MAX_CATEGORIES = 8;

export const categorySchema = z.object({
  // Language independent; used as a filter in URLs.
  key: kebabCase(60),
  name: bilingual(60),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type Category = CategoryInput & { id: string };

// Strict on purpose: a product has no price, so a stray `price` is an error, not silently dropped.
export const productSchema = z.strictObject({
  categoryId: idSchema,
  // The language-independent address of the product page.
  slug: kebabCase(80),
  code: z.string().trim().min(1).max(60),
  name: bilingual(120),
  color: bilingual(60),
  material: bilingual(100),
  power: z.string().trim().min(1).max(40),
  dimensions: z.string().trim().min(1).max(60),
  imageUrl: httpsUrl,
});

export type ProductInput = z.infer<typeof productSchema>;
export type Product = ProductInput & { id: string; categoryKey: string };

export const catalogSchema = z.object({
  name: bilingual(120),
  // A Blob address from the storage module.
  pdfUrl: httpsUrl,
  // Bytes; the upper bound is the largest value the column holds.
  sizeBytes: z.int().min(1).max(2_147_483_647),
});

export type CatalogInput = z.infer<typeof catalogSchema>;
export type Catalog = CatalogInput & { id: string };

// A button of the home banner: its text and the public page it opens.
const bannerActionSchema = z.strictObject({
  label: bilingual(40),
  target: pageKeySchema,
});

export const homeBannerSchema = z.strictObject({
  imageUrl: httpsUrl,
  title: bilingual(120),
  description: bilingual(400),
  primaryAction: bannerActionSchema,
  secondaryAction: bannerActionSchema,
});

export type HomeBanner = z.infer<typeof homeBannerSchema>;

// The order of the list is the order on the home page. Each product can appear once.
export const featuredProductIdsSchema = idListSchema.refine((ids) => new Set(ids).size === ids.length, {
  message: 'Each product can be featured once',
});

export const promoBoardSchema = z.strictObject({
  imageUrl: httpsUrl,
  title: bilingual(100),
  // The catalog the board links to.
  catalogId: idSchema,
});

export type PromoBoardInput = z.infer<typeof promoBoardSchema>;
// The name and file address of the linked catalog are read along, so a page needs no second query.
export type PromoBoard = PromoBoardInput & { id: string; catalogName: Bilingual; catalogPdfUrl: string };

export const applicationAreaSchema = z.strictObject({
  imageUrl: httpsUrl,
  title: bilingual(100),
  // Short plain text.
  description: bilingual(300),
});

export type ApplicationAreaInput = z.infer<typeof applicationAreaSchema>;
export type ApplicationArea = ApplicationAreaInput & { id: string };

export const serviceSchema = z.strictObject({
  imageUrl: httpsUrl,
  title: bilingual(100),
  // Limited Markdown, stored as plain text and rendered by src/components/markdown-content.tsx.
  description: bilingual(5000),
  // An extra remark under the card: filled in both languages, or empty in both.
  note: optionalBilingual(500),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
export type Service = ServiceInput & { id: string };

export const aboutPageSchema = z.strictObject({
  // Limited Markdown, stored as plain text and rendered by src/components/markdown-content.tsx.
  body: bilingual(50_000),
  // The vision is a section of the about page.
  vision: bilingual(50_000),
});

export type AboutPage = z.infer<typeof aboutPageSchema>;
