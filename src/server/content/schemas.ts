import { z } from 'zod';
import { bilingual } from './bilingual.ts';
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
