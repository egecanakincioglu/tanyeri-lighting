import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db.ts';
import { createCategory } from '../content/categories.ts';
import { createProduct, updateProduct } from '../content/products.ts';
import { findEnquiryProduct } from './product-enquiry.ts';

const pair = (tr: string, en: string) => ({ tr, en });

function input(categoryId: string, slug: string) {
  return {
    categoryId,
    slug,
    code: 'RS-12',
    name: pair('Ray Spot', 'Track Spot'),
    color: pair('Mat siyah', 'Matte black'),
    material: pair('Alüminyum', 'Aluminium'),
    power: '12 W',
    dimensions: 'Ø 120 × 85 mm',
    imageUrl: 'https://store.example.com/ray-spot.webp',
  };
}

describe('the product of a contact enquiry on a real database', () => {
  let categoryId: string;
  let productId: string;

  beforeEach(async () => {
    await getDb().product.deleteMany();
    await getDb().category.deleteMany();
    categoryId = (await createCategory({ key: 'indoor', name: pair('İç mekan', 'Indoor') })).id;
    productId = (await createProduct(input(categoryId, 'ray-spot'))).id;
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('returns the name in the page language and the code', async () => {
    expect(await findEnquiryProduct('ray-spot', 'tr')).toEqual({ name: 'Ray Spot', code: 'RS-12' });
    expect(await findEnquiryProduct('ray-spot', 'en')).toEqual({ name: 'Track Spot', code: 'RS-12' });
  });

  it('gives nothing for an unknown slug', async () => {
    expect(await findEnquiryProduct('no-such-product', 'en')).toBeNull();
  });

  it('gives nothing for a missing, empty or repeated value', async () => {
    expect(await findEnquiryProduct(undefined, 'en')).toBeNull();
    expect(await findEnquiryProduct('', 'en')).toBeNull();
    expect(await findEnquiryProduct(['ray-spot', 'x'], 'en')).toBeNull();
  });

  it('gives nothing for a slug the product used to have', async () => {
    await updateProduct(productId, input(categoryId, 'ray-spot-2'));
    expect(await findEnquiryProduct('ray-spot', 'en')).toBeNull();
    expect(await findEnquiryProduct('ray-spot-2', 'en')).toEqual({ name: 'Track Spot', code: 'RS-12' });
  });
});
