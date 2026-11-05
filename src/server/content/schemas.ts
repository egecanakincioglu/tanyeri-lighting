import { z } from 'zod';
import { type Bilingual, bilingual, optionalBilingual } from './bilingual.ts';
import { isValidPhone } from './phone.ts';

// Lengths are hard limits for storage and layout; shorter SEO advice belongs to the admin form.

const MAX_URL_LENGTH = 2048;

// https only: stored addresses end up in links and structured data.
const httpsUrl = z
  .url({ protocol: /^https$/ })
  .trim()
  .max(MAX_URL_LENGTH);

// Demo files live in public/demo. Exact prefix, no parent step, no protocol-relative address.
const demoPath = z
  .string()
  .trim()
  .max(MAX_URL_LENGTH)
  .regex(/^\/demo\/[A-Za-z0-9._/-]+$/)
  .refine((path) => !path.includes('..') && !path.includes('//'));

const mediaUrl = z.union([httpsUrl, demoPath]);

export const siteSettingsSchema = z.object({
  siteName: bilingual(100),
  logoUrl: mediaUrl.nullable(),
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

export const PAGE_KEYS = [
  'home',
  'products',
  'catalogs',
  'services',
  'projects',
  'blog',
  'references',
  'about',
  'vision',
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
  body: bilingual(50_000),
});

type LegalPageInput = z.infer<typeof legalPageSchema>;
export type LegalPage = LegalPageInput & { updatedAt: Date };

export const projectSchema = z.object({
  title: bilingual(150),
  description: bilingual(5000),
  beforeImageUrl: mediaUrl,
  afterImageUrl: mediaUrl,
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type Project = ProjectInput & { id: string };

export const projectIdSchema = z.string().min(1).max(64);
export const projectOrderSchema = z.array(projectIdSchema);

const imageAlt = optionalBilingual(200);

export const referenceSchema = z.object({
  imageUrl: mediaUrl,
  imageAlt,
  name: z.string().trim().min(1).max(100),
  title: bilingual(100),
  description: bilingual(500),
});

export type ReferenceInput = z.infer<typeof referenceSchema>;
export type Reference = ReferenceInput & { id: string };

export const referenceIdSchema = z.string().min(1).max(64);
export const referenceOrderSchema = z.array(referenceIdSchema);

// Ids come from the database; a sent id is checked for shape only.
export const idSchema = z.string().min(1).max(64);
export const idListSchema = z.array(idSchema);

export const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const kebabCase = (maxLength: number) =>
  z.string().trim().min(1).max(maxLength).regex(KEBAB_CASE, 'Use lowercase letters, digits and single hyphens');

export const MAX_CATEGORIES = 8;

export const categorySchema = z.object({
  key: kebabCase(60),
  name: bilingual(60),
  // Filled in both languages or neither; an empty one falls back to the name. No brand: the site template adds it.
  seoTitle: optionalBilingual(70).default({ tr: '', en: '' }),
  seoDescription: optionalBilingual(320).default({ tr: '', en: '' }),
  h1: optionalBilingual(100).default({ tr: '', en: '' }),
  intro: optionalBilingual(600).default({ tr: '', en: '' }),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type Category = CategoryInput & { id: string };

// Strict: a product has no price, so a stray `price` is an error, not dropped.
export const productSchema = z.strictObject({
  categoryId: idSchema,
  slug: kebabCase(80),
  code: z.string().trim().min(1).max(60),
  name: bilingual(120),
  color: bilingual(60),
  material: bilingual(100),
  power: z.string().trim().min(1).max(40),
  dimensions: z.string().trim().min(1).max(60),
  description: optionalBilingual(500).default({ tr: '', en: '' }),
  // Values with a unit, such as "1050 lm"; empty leaves the row out.
  luminousFlux: z.string().trim().max(20).default(''),
  colorTemperature: z.string().trim().max(20).default(''),
  cri: z.string().trim().max(20).default(''),
  ip: z.string().trim().max(20).default(''),
  imageUrl: mediaUrl,
});

export type ProductInput = z.infer<typeof productSchema>;
export type Product = ProductInput & { id: string; categoryKey: string };

export const catalogSchema = z.object({
  name: bilingual(120),
  pdfUrl: mediaUrl,
  coverImageUrl: mediaUrl.or(z.literal('')),
  imageAlt,
  // Bytes, up to the largest value the column holds.
  sizeBytes: z.int().min(1).max(2_147_483_647),
});

export type CatalogInput = z.infer<typeof catalogSchema>;
export type Catalog = CatalogInput & { id: string };

const bannerActionSchema = z.strictObject({
  label: bilingual(40),
  target: pageKeySchema,
});

export const homeBannerSchema = z.strictObject({
  imageUrl: mediaUrl,
  imageAlt,
  title: bilingual(120),
  description: bilingual(400),
  primaryAction: bannerActionSchema,
  secondaryAction: bannerActionSchema,
});

export type HomeBanner = z.infer<typeof homeBannerSchema>;

// Each product can appear once; the home grid has room for six.
export const FEATURED_LIMIT = 6;

export const featuredProductIdsSchema = idListSchema
  .max(FEATURED_LIMIT)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Each product can be featured once',
  });

export const promoBoardSchema = z.strictObject({
  imageUrl: mediaUrl,
  imageAlt,
  title: bilingual(100),
  subtitle: optionalBilingual(120),
  catalogId: idSchema,
});

export type PromoBoardInput = z.infer<typeof promoBoardSchema>;
export type PromoBoard = PromoBoardInput & { id: string; catalogName: Bilingual; catalogPdfUrl: string };

export const applicationAreaSchema = z.strictObject({
  imageUrl: mediaUrl,
  imageAlt,
  title: bilingual(100),
  description: bilingual(300),
  categoryId: idSchema.nullable().default(null),
});

export type ApplicationAreaInput = z.infer<typeof applicationAreaSchema>;
export type ApplicationArea = ApplicationAreaInput & { id: string; categoryKey: string | null };

export const serviceSchema = z.strictObject({
  imageUrl: mediaUrl,
  imageAlt,
  title: bilingual(100),
  description: bilingual(5000),
  // An extra remark under the card: both languages or neither.
  note: optionalBilingual(500),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
export type Service = ServiceInput & { id: string };

export const blogPostSchema = z.strictObject({
  slug: kebabCase(80),
  title: bilingual(120),
  description: bilingual(320),
  excerpt: bilingual(320),
  body: bilingual(50_000),
  imageUrl: mediaUrl,
  imageAlt: bilingual(200),
  // Empty means a draft; a future day publishes on that day.
  publishedAt: z.date().nullable(),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;
export type BlogPost = BlogPostInput & { id: string; createdAt: Date; updatedAt: Date };
export type BlogPostSummary = Omit<BlogPost, 'body'>;

export const aboutPageSchema = z.strictObject({
  body: bilingual(50_000),
  vision: bilingual(50_000),
});

export type AboutPage = z.infer<typeof aboutPageSchema>;
