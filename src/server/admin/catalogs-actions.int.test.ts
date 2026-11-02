import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startFakeBlobServer } from '../../test/blob-server.ts';
import type { FakeBlobServer } from '../../test/blob-server.ts';
import { listCatalogs } from '../content/catalogs.ts';
import { getDb } from '../db.ts';
import { uploadFile } from '../storage/index.ts';
import {
  createCatalogAction,
  deleteCatalogAction,
  reorderCatalogsAction,
  updateCatalogAction,
} from './catalogs-actions.ts';

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

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const PDF = new TextEncoder().encode('%PDF-1.4\nbody of the catalog\n%%EOF');
const COVER = '/demo/area-otel.webp';

let server: FakeBlobServer;
let pdfUrl = '';

beforeAll(async () => {
  server = await startFakeBlobServer();
});

afterAll(async () => {
  await server.close();
  await getDb().$disconnect();
});

const valid = (name: string, extra: Record<string, string> = {}) => ({
  'name.tr': `${name} katalog`,
  'name.en': `${name} catalog`,
  pdfUrl,
  coverImageUrl: COVER,
  ...extra,
});

async function names(): Promise<string[]> {
  return (await listCatalogs()).map((item) => item.name.en);
}

describe('catalog actions on a real database', () => {
  beforeEach(async () => {
    vi.stubEnv('VERCEL_BLOB_API_URL', server.url);
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_teststore_secretpart');
    pdfUrl = (await uploadFile(new Blob([PDF]))).url;
    server.requests.length = 0;
    await getDb().promoBoard.deleteMany();
    await getDb().catalog.deleteMany();
    mocks.guardAction.mockClear();
    mocks.guardAction.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.refresh.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a catalog with the size the file store reports, not a size from the form', async () => {
    await expect(createCatalogAction(null, form(valid('Alpha', { locale: 'en', sizeBytes: '1' })))).rejects.toThrow(
      'redirect:/en/admin/catalogs',
    );
    const [item] = await listCatalogs();
    expect(item).toMatchObject({ pdfUrl, coverImageUrl: COVER, sizeBytes: PDF.byteLength });
    await expect(createCatalogAction(null, form(valid('Beta', { locale: 'tr' })))).rejects.toThrow(
      'redirect:/tr/yonetim/kataloglar',
    );
    expect(await names()).toEqual(['Alpha catalog', 'Beta catalog']);
  });

  it('reports the invalid fields and writes nothing', async () => {
    const result = await createCatalogAction(null, form(valid('Alpha', { pdfUrl: '', 'name.en': '' })));
    expect(result).toMatchObject({
      status: 'error',
      code: 'invalid',
      fieldErrors: { pdfUrl: { code: 'invalid' }, 'name.en': { code: 'required' } },
    });
    expect(await names()).toEqual([]);
  });

  it('says the file store is off, and not a generic failure, for a new file without one', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    expect(await createCatalogAction(null, form(valid('Alpha')))).toMatchObject({ code: 'storageOff' });
    expect(await names()).toEqual([]);
  });

  it('updates the name without asking the file store when the PDF did not change', async () => {
    await expect(createCatalogAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
    const [item] = await listCatalogs();
    server.requests.length = 0;
    expect(await updateCatalogAction(null, form(valid('Alpha 2', { id: item!.id, sizeBytes: '5' })))).toEqual({
      status: 'success',
    });
    expect(server.requests).toHaveLength(0);
    expect(await listCatalogs()).toMatchObject([{ name: { en: 'Alpha 2 catalog' }, sizeBytes: PDF.byteLength }]);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('takes the size of a replaced PDF from the file store', async () => {
    await expect(createCatalogAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
    const [item] = await listCatalogs();
    const bigger = new TextEncoder().encode(`%PDF-1.4\n${'x'.repeat(500)}\n%%EOF`);
    const replaced = (await uploadFile(new Blob([bigger]))).url;
    expect(await updateCatalogAction(null, form(valid('Alpha', { id: item!.id, pdfUrl: replaced })))).toEqual({
      status: 'success',
    });
    expect((await listCatalogs())[0]).toMatchObject({ pdfUrl: replaced, sizeBytes: bigger.byteLength });
  });

  it('says not found for a catalog that no longer exists', async () => {
    expect(await updateCatalogAction(null, form(valid('Alpha', { id: 'missing' })))).toMatchObject({
      code: 'notFound',
    });
    expect(await deleteCatalogAction(null, form({ id: 'missing' }))).toMatchObject({ code: 'notFound' });
  });

  it('deletes a catalog, and refuses one that a promo board still uses', async () => {
    await expect(createCatalogAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
    await expect(createCatalogAction(null, form(valid('Beta')))).rejects.toThrow('redirect:');
    const [alpha, beta] = await listCatalogs();
    await getDb().promoBoard.create({
      data: { imageUrl: COVER, titleTr: 'Pano', titleEn: 'Board', catalogId: alpha!.id, sortOrder: 0 },
    });
    expect(await deleteCatalogAction(null, form({ id: alpha!.id }))).toMatchObject({
      status: 'error',
      code: 'catalogInUse',
    });
    expect(await deleteCatalogAction(null, form({ id: beta!.id }))).toEqual({ status: 'success' });
    expect(await names()).toEqual(['Alpha catalog']);
  });

  it('reorders the list, and refuses an order that is not the complete list', async () => {
    for (const name of ['A', 'B', 'C']) {
      await expect(createCatalogAction(null, form(valid(name)))).rejects.toThrow('redirect:');
    }
    const ids = (await listCatalogs()).map((item) => item.id);
    expect(await reorderCatalogsAction([ids[2]!, ids[0]!, ids[1]!])).toEqual({ status: 'success' });
    expect(await names()).toEqual(['C catalog', 'A catalog', 'B catalog']);
    expect(await reorderCatalogsAction([ids[0]!])).toMatchObject({ code: 'invalidOrder' });
    expect(await reorderCatalogsAction('nope' as unknown as string[])).toMatchObject({ code: 'invalidOrder' });
  });

  describe('without a session', () => {
    beforeEach(async () => {
      await expect(createCatalogAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
      const { UnauthorizedError } = await import('../auth/guard.ts');
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    });

    it('refuses every action and changes nothing', async () => {
      const [item] = await listCatalogs();
      const results = [
        await createCatalogAction(null, form(valid('Beta'))),
        await updateCatalogAction(null, form(valid('Changed', { id: item!.id }))),
        await deleteCatalogAction(null, form({ id: item!.id })),
        await reorderCatalogsAction([item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(await names()).toEqual(['Alpha catalog']);
    });
  });

  describe('in demo mode', () => {
    beforeEach(async () => {
      await expect(createCatalogAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
      vi.stubEnv('DEMO_MODE', 'true');
    });

    it('reads everything and writes nothing', async () => {
      const [item] = await listCatalogs();
      const results = [
        await createCatalogAction(null, form(valid('Beta', { pdfUrl: '/demo/new.pdf' }))),
        await updateCatalogAction(null, form(valid('Changed', { id: item!.id }))),
        await deleteCatalogAction(null, form({ id: item!.id })),
        await reorderCatalogsAction([item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'demo' });
      expect(await names()).toEqual(['Alpha catalog']);
    });
  });
});
