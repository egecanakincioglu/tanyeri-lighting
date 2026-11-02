import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startFakeBlobServer } from '../../test/blob-server.ts';
import type { FakeBlobServer } from '../../test/blob-server.ts';
import { listApplicationAreas } from '../content/application-areas.ts';
import { createCatalog, listCatalogs } from '../content/catalogs.ts';
import { createCategory } from '../content/categories.ts';
import { getHomeBanner } from '../content/home-banner.ts';
import { listProducts } from '../content/products.ts';
import { listProjects } from '../content/projects.ts';
import { listPromoBoards } from '../content/promo-boards.ts';
import { listReferences } from '../content/references.ts';
import { listServices } from '../content/services.ts';
import { getSiteSettings } from '../content/site-settings.ts';
import { getDb } from '../db.ts';
import { uploadFile } from '../storage/index.ts';
import {
  createApplicationAreaAction,
  deleteApplicationAreaAction,
  updateApplicationAreaAction,
} from './application-areas-actions.ts';
import { updateBannerAction } from './banner-actions.ts';
import { createCatalogAction, deleteCatalogAction, updateCatalogAction } from './catalogs-actions.ts';
import { updateSiteSettingsAction } from './corporate-actions.ts';
import { createProductAction, deleteProductAction, updateProductAction } from './products-actions.ts';
import { createProjectAction, deleteProjectAction, updateProjectAction } from './projects-actions.ts';
import { createPromoBoardAction, deletePromoBoardAction, updatePromoBoardAction } from './promo-boards-actions.ts';
import { createReferenceAction, deleteReferenceAction, updateReferenceAction } from './references-actions.ts';
import { createServiceAction, deleteServiceAction, updateServiceAction } from './services-actions.ts';

const mocks = vi.hoisted(() => ({ guardAction: vi.fn(), refresh: vi.fn() }));

vi.mock('../auth/guard.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/guard.ts')>()),
  guardAction: mocks.guardAction,
}));
vi.mock('next/cache', () => ({ refresh: mocks.refresh }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  redirect: (target: string) => {
    throw new Error(`redirect:${target}`);
  },
}));

type Action = (previous: null, formData: FormData) => Promise<unknown>;

interface Family {
  name: string;
  // The form fields that hold a stored file, and the ones among them that may hold a demo picture.
  fileFields: string[];
  demoFields: string[];
  base: () => Record<string, string>;
  // A record that is created and removed; the banner and the company details exist once and are only updated.
  create?: Action;
  update: Action;
  remove?: Action;
  ids?: () => Promise<string[]>;
  clean: () => Promise<unknown>;
  prepare?: () => Promise<void>;
}

const pair = (field: string, value: string) => ({ [`${field}.tr`]: `${value} tr`, [`${field}.en`]: value });

let categoryId = '';
let catalogId = '';

const families: Family[] = [
  {
    name: 'references',
    fileFields: ['imageUrl'],
    demoFields: ['imageUrl'],
    base: () => ({ name: 'Alpha', ...pair('title', 'Work'), ...pair('description', 'Short description.') }),
    create: createReferenceAction,
    update: updateReferenceAction,
    remove: deleteReferenceAction,
    ids: async () => (await listReferences()).map((item) => item.id),
    clean: () => getDb().reference.deleteMany(),
  },
  {
    name: 'promo boards',
    fileFields: ['imageUrl'],
    demoFields: ['imageUrl'],
    base: () => ({ ...pair('title', 'Board'), ...pair('subtitle', 'Line'), catalogId }),
    create: createPromoBoardAction,
    update: updatePromoBoardAction,
    remove: deletePromoBoardAction,
    ids: async () => (await listPromoBoards()).map((item) => item.id),
    clean: async () => {
      await getDb().promoBoard.deleteMany();
      await getDb().catalog.deleteMany();
    },
    prepare: async () => {
      catalogId = (
        await createCatalog({
          name: { tr: 'Genel', en: 'General' },
          pdfUrl: (await uploadFile(new Blob([PDF]))).url,
          coverImageUrl: '',
          sizeBytes: 1,
        })
      ).id;
    },
  },
  {
    name: 'application areas',
    fileFields: ['imageUrl'],
    demoFields: ['imageUrl'],
    base: () => ({ ...pair('title', 'Area'), ...pair('description', 'Short description.') }),
    create: createApplicationAreaAction,
    update: updateApplicationAreaAction,
    remove: deleteApplicationAreaAction,
    ids: async () => (await listApplicationAreas()).map((item) => item.id),
    clean: () => getDb().applicationArea.deleteMany(),
  },
  {
    name: 'services',
    fileFields: ['imageUrl'],
    demoFields: ['imageUrl'],
    base: () => ({
      ...pair('title', 'Service'),
      ...pair('description', 'Short description.'),
      'note.tr': '',
      'note.en': '',
    }),
    create: createServiceAction,
    update: updateServiceAction,
    remove: deleteServiceAction,
    ids: async () => (await listServices()).map((item) => item.id),
    clean: () => getDb().service.deleteMany(),
  },
  {
    name: 'projects',
    fileFields: ['beforeImageUrl', 'afterImageUrl'],
    demoFields: ['beforeImageUrl', 'afterImageUrl'],
    base: () => ({ ...pair('title', 'Project'), ...pair('description', 'Short description.') }),
    create: createProjectAction,
    update: updateProjectAction,
    remove: deleteProjectAction,
    ids: async () => (await listProjects()).map((item) => item.id),
    clean: () => getDb().project.deleteMany(),
  },
  {
    name: 'products',
    fileFields: ['imageUrl'],
    demoFields: ['imageUrl'],
    base: () => ({
      categoryId,
      slug: 'lamp',
      code: 'LAMP',
      ...pair('name', 'Lamp'),
      ...pair('color', 'White'),
      ...pair('material', 'Metal'),
      power: '10 W',
      dimensions: '10 x 10 cm',
    }),
    create: createProductAction,
    update: updateProductAction,
    remove: deleteProductAction,
    ids: async () => (await listProducts()).map((item) => item.id),
    clean: async () => {
      await getDb().featuredProduct.deleteMany();
      await getDb().product.deleteMany();
      await getDb().category.deleteMany();
    },
    prepare: async () => {
      categoryId = (await createCategory({ key: 'indoor', name: { tr: 'İç mekan', en: 'Indoor' } })).id;
    },
  },
  {
    name: 'catalogs',
    fileFields: ['pdfUrl', 'coverImageUrl'],
    // A catalog needs its PDF in the file store; only the cover may be a demo picture.
    demoFields: ['coverImageUrl'],
    base: () => pair('name', 'Catalog'),
    create: createCatalogAction,
    update: updateCatalogAction,
    remove: deleteCatalogAction,
    ids: async () => (await listCatalogs()).map((item) => item.id),
    clean: async () => {
      await getDb().promoBoard.deleteMany();
      await getDb().catalog.deleteMany();
    },
  },
  {
    name: 'home banner',
    fileFields: ['imageUrl'],
    demoFields: ['imageUrl'],
    base: () => ({
      ...pair('title', 'Title'),
      ...pair('description', 'Short description.'),
      ...pair('primaryLabel', 'Products'),
      primaryTarget: 'products',
      ...pair('secondaryLabel', 'Contact'),
      secondaryTarget: 'contact',
    }),
    update: updateBannerAction,
    clean: () => getDb().homeBanner.deleteMany(),
  },
  {
    name: 'company logo',
    fileFields: ['logoUrl'],
    demoFields: ['logoUrl'],
    base: () => ({
      ...pair('siteName', 'Tanyeri Lighting'),
      phone: '+90 212 000 00 00',
      email: 'info@example.com',
      ...pair('address', 'Example District 1'),
      ...pair('workingHours', 'Monday - Friday 09:00 - 18:00'),
      ...pair('serviceArea', 'All over Turkey'),
      ...pair('languages', 'Turkish, English'),
    }),
    update: updateSiteSettingsAction,
    clean: () => getDb().siteSettings.deleteMany(),
  },
];

const PDF = new TextEncoder().encode('%PDF-1.4\nbody of the catalog\n%%EOF');

let server: FakeBlobServer;
let counter = 0;

// A new address in the file store for a field; a PDF is really uploaded because the catalog asks the store for its size.
async function stored(field: string): Promise<string> {
  if (field === 'pdfUrl') return (await uploadFile(new Blob([PDF]))).url;
  counter += 1;
  return `https://store.public.blob.vercel-storage.com/${field}-${counter}.webp`;
}

async function storedFiles(fields: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const field of fields) result[field] = await stored(field);
  return result;
}

function demoFiles(fields: string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, `/demo/${field}.webp`]));
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

// Saves the family's first record (or its only one) with these files and returns its id; the file store has seen no
// deletion yet when it returns.
async function seed(family: Family, files: Record<string, string>): Promise<string> {
  const fields = { ...family.base(), ...files };
  if (family.create) {
    await expect(family.create(null, form(fields))).rejects.toThrow('redirect:');
  } else {
    await family.update(null, form(fields));
  }
  server.deleted.length = 0;
  return family.ids ? (await family.ids())[0]! : '';
}

function save(family: Family, id: string, files: Record<string, string>): Promise<unknown> {
  return family.update(null, form({ ...family.base(), ...files, ...(id ? { id } : {}) }));
}

const sorted = (values: string[]) => [...values].sort();

beforeAll(async () => {
  server = await startFakeBlobServer();
});

afterAll(async () => {
  await server.close();
  await getDb().$disconnect();
});

describe.each(families)('files of $name in the file store', (family) => {
  beforeEach(async () => {
    vi.stubEnv('VERCEL_BLOB_API_URL', server.url);
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_teststore_secretpart');
    await family.clean();
    await family.prepare?.();
    mocks.guardAction.mockClear();
    mocks.guardAction.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.refresh.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('deletes the old files when they are replaced', async () => {
    const old = await storedFiles(family.fileFields);
    const id = await seed(family, old);
    const next = await storedFiles(family.fileFields);
    expect(await save(family, id, next)).toEqual({ status: 'success' });
    expect(sorted(server.deleted)).toEqual(sorted(Object.values(old)));
  });

  it('keeps a file that did not change and deletes the one that did', async () => {
    const old = await storedFiles(family.fileFields);
    const id = await seed(family, old);
    const changed = family.fileFields[0]!;
    expect(await save(family, id, { ...old, [changed]: await stored(changed) })).toEqual({ status: 'success' });
    expect(server.deleted).toEqual([old[changed]]);
  });

  it('deletes nothing when the files stay as they are', async () => {
    const old = await storedFiles(family.fileFields);
    const id = await seed(family, old);
    expect(await save(family, id, old)).toEqual({ status: 'success' });
    expect(server.deleted).toEqual([]);
  });

  it('never deletes a demo picture, replaced or removed', async () => {
    const kept = await storedFiles(family.fileFields.filter((field) => !family.demoFields.includes(field)));
    const id = await seed(family, { ...kept, ...demoFiles(family.demoFields) });
    const next = Object.fromEntries(family.demoFields.map((field) => [field, `/demo/other-${field}.webp`]));
    expect(await save(family, id, { ...kept, ...next })).toEqual({ status: 'success' });
    expect(server.deleted).toEqual([]);
    if (family.remove) {
      expect(await family.remove(null, form({ id }))).toEqual({ status: 'success' });
      expect(sorted(server.deleted)).toEqual(sorted(Object.values(kept)));
    }
  });

  if (family.remove) {
    const remove = family.remove;
    it('deletes the files of a record that is deleted', async () => {
      const old = await storedFiles(family.fileFields);
      const id = await seed(family, old);
      expect(await remove(null, form({ id }))).toEqual({ status: 'success' });
      expect(sorted(server.deleted)).toEqual(sorted(Object.values(old)));
      expect(await family.ids!()).toEqual([]);
    });

    it('does not fail a delete when the file store refuses to delete', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const id = await seed(family, await storedFiles(family.fileFields));
      server.failNextWith('forbidden', 403);
      expect(await remove(null, form({ id }))).toEqual({ status: 'success' });
      expect(await family.ids!()).toEqual([]);
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });
  } else {
    it('does not fail a save when the file store refuses to delete', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const id = await seed(family, await storedFiles(family.fileFields));
      server.failNextWith('forbidden', 403);
      expect(await save(family, id, await storedFiles(family.fileFields))).toEqual({ status: 'success' });
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });
  }
});

describe('the singletons', () => {
  beforeEach(async () => {
    vi.stubEnv('VERCEL_BLOB_API_URL', server.url);
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_teststore_secretpart');
    mocks.guardAction.mockClear();
    mocks.guardAction.mockResolvedValue({ user: { email: 'admin@example.com' } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('deletes the old logo when the logo is taken off, and saves no logo', async () => {
    const family = families.find((item) => item.name === 'company logo')!;
    await family.clean();
    const logoUrl = await stored('logoUrl');
    await seed(family, { logoUrl });
    expect(await save(family, '', { logoUrl: '' })).toEqual({ status: 'success' });
    expect(server.deleted).toEqual([logoUrl]);
    expect((await getSiteSettings()).logoUrl).toBeNull();
  });

  it('saves the new banner picture and deletes the old one', async () => {
    const family = families.find((item) => item.name === 'home banner')!;
    await family.clean();
    const imageUrl = await stored('imageUrl');
    await seed(family, { imageUrl });
    const next = await stored('imageUrl');
    await save(family, '', { imageUrl: next });
    expect((await getHomeBanner()).imageUrl).toBe(next);
    expect(server.deleted).toEqual([imageUrl]);
  });
});
