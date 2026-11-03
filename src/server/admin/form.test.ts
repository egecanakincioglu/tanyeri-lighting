import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '../auth/guard.ts';
import {
  CatalogInUseError,
  CategoryLimitError,
  CategoryNotEmptyError,
  ContentNotFoundError,
  InvalidOrderError,
  ValueTakenError,
} from '../content/errors.ts';
import { referenceSchema } from '../content/schemas.ts';
import { DemoModeError } from '../demo/guard.ts';
import { StorageDisabledError, StorageRequestError, UploadRejectedError } from '../storage/index.ts';
import { failure, formPair, formText, runAction } from './form.ts';

vi.mock('../auth/guard.ts', () => ({
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

const bad = () => Promise.reject(new Error('boom'));

describe('runAction', () => {
  it('answers success when the work returns nothing, and passes a returned state on', async () => {
    expect(await runAction(async () => {})).toEqual({ status: 'success' });
    expect(await runAction(async () => ({ status: 'success', url: 'https://x.example/a.webp' }))).toEqual({
      status: 'success',
      url: 'https://x.example/a.webp',
    });
    expect(await runAction(async () => failure('invalidOrder'))).toMatchObject({ code: 'invalidOrder' });
  });

  it('maps zod issues to field errors by path, with the limit for a text that is too long', async () => {
    const result = await runAction(async () => {
      referenceSchema.parse({
        imageUrl: 'https://store.example.com/a.webp',
        imageAlt: { tr: '', en: '' },
        name: '',
        title: { tr: 'a'.repeat(101), en: 'ok' },
        description: { tr: 'ok', en: 'ok' },
      });
    });
    expect(result).toEqual({
      status: 'error',
      code: 'invalid',
      fieldErrors: { name: { code: 'required' }, 'title.tr': { code: 'tooLong', max: 100 } },
    });
  });

  it('marks a malformed value as invalid and keeps only the first issue of a field', async () => {
    const result = await runAction(async () => {
      referenceSchema.parse({
        imageUrl: 'not an address',
        imageAlt: { tr: '', en: '' },
        name: 'A',
        title: { tr: 'a', en: 'a' },
        description: { tr: 'a', en: 'a' },
      });
    });
    expect(result).toMatchObject({ code: 'invalid', fieldErrors: { imageUrl: { code: 'invalid' } } });
  });

  it.each([
    [new DemoModeError(), 'demo'],
    [new UnauthorizedError(), 'unauthorized'],
    [new ContentNotFoundError('Reference'), 'notFound'],
    [new InvalidOrderError(), 'invalidOrder'],
    [new CategoryLimitError(8), 'categoryLimit'],
    [new CategoryNotEmptyError(), 'categoryNotEmpty'],
    [new CatalogInUseError(), 'catalogInUse'],
    [new StorageDisabledError(), 'storageOff'],
    [new UploadRejectedError('too-large', 'x'), 'tooLarge'],
    [new UploadRejectedError('unsupported-type', 'x'), 'unsupportedType'],
    [new UploadRejectedError('unreadable-image', 'x'), 'unreadableImage'],
  ])('maps %s to the code %s', async (error, code) => {
    expect(await runAction(() => Promise.reject(error))).toEqual({ status: 'error', code, fieldErrors: {} });
  });

  it('marks the field that collided when a unique value is taken', async () => {
    expect(await runAction(() => Promise.reject(new ValueTakenError('slug')))).toEqual({
      status: 'error',
      code: 'taken',
      fieldErrors: { slug: { code: 'taken' } },
    });
    expect(await runAction(() => Promise.reject(new ValueTakenError('code')))).toMatchObject({
      fieldErrors: { code: { code: 'taken' } },
    });
  });

  it('answers any other error with a generic code and logs the real one on the server', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const generic = await runAction(bad);
    expect(generic).toEqual({ status: 'error', code: 'generic', fieldErrors: {} });
    expect(JSON.stringify(generic)).not.toContain('boom');
    expect(await runAction(() => Promise.reject(new StorageRequestError('upload', new Error('vendor'))))).toMatchObject(
      {
        code: 'generic',
      },
    );
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});

describe('form readers', () => {
  it('reads text, and an empty string for a missing field or a file', () => {
    const data = new FormData();
    data.set('name', 'Alpha');
    data.set('file', new Blob(['x']));
    expect(formText(data, 'name')).toBe('Alpha');
    expect(formText(data, 'missing')).toBe('');
    expect(formText(data, 'file')).toBe('');
  });

  it('reads a bilingual pair from the .tr and .en inputs', () => {
    const data = new FormData();
    data.set('title.tr', 'Otel');
    data.set('title.en', 'Hotel');
    expect(formPair(data, 'title')).toEqual({ tr: 'Otel', en: 'Hotel' });
    expect(formPair(data, 'other')).toEqual({ tr: '', en: '' });
  });
});
