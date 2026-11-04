import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormState } from '../../../server/admin/form.ts';
import { getTranslations } from '../../../test/translations.ts';
import { buildFormTexts } from '../texts.ts';
import { ProductForm } from './product-form.tsx';

const formTexts = buildFormTexts(await getTranslations({ locale: 'en', namespace: 'AdminForm' }));
const media = await getTranslations({ locale: 'en', namespace: 'AdminMedia' });
const mediaTexts = {
  choose: media('choose'),
  replace: media('replace'),
  clear: media('clear'),
  uploading: media('uploading'),
  none: media('none'),
  hint: media('imageHint'),
  open: media('open'),
};
const texts = {
  image: 'Image',
  category: 'Category',
  slug: 'Address',
  slugHint: 'Hint.',
  slugRedirectHint: 'Redirect.',
  code: 'Code',
  name: 'Name',
  color: 'Colour',
  material: 'Material',
  power: 'Power',
  dimensions: 'Dimensions',
  description: 'Description',
  luminousFlux: 'Luminous flux',
  colorTemperature: 'Colour temperature',
  cri: 'CRI',
  ip: 'IP rating',
  cancel: 'Cancel',
};

const action = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();
const upload = vi.fn<(address: string, kind: 'image' | 'file') => Promise<FormState>>();

function setup() {
  return render(
    <NextIntlClientProvider locale="en" messages={{}}>
      <ProductForm
        action={action}
        upload={upload}
        locale="en"
        categories={[{ value: 'c1', label: 'Indoor' }]}
        texts={texts}
        formTexts={formTexts}
        mediaTexts={mediaTexts}
      />
    </NextIntlClientProvider>,
  );
}

describe('ProductForm', () => {
  beforeEach(() => {
    action.mockClear();
  });
  afterEach(cleanup);

  it('sends the description and the technical values, which may stay empty', async () => {
    action.mockResolvedValue({ status: 'success' });
    setup();
    expect((screen.getByLabelText('Luminous flux') as HTMLInputElement).required).toBe(false);
    expect((screen.getByLabelText('IP rating') as HTMLInputElement).required).toBe(false);
    fireEvent.change(screen.getByLabelText('Luminous flux'), { target: { value: '1050 lm' } });
    fireEvent.change(screen.getByLabelText('Colour temperature'), { target: { value: '3000 K' } });
    fireEvent.change(screen.getByLabelText('CRI'), { target: { value: 'Ra 90' } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!);
    });
    const data = action.mock.calls[0]![1];
    expect(data.get('luminousFlux')).toBe('1050 lm');
    expect(data.get('colorTemperature')).toBe('3000 K');
    expect(data.get('cri')).toBe('Ra 90');
    expect(data.get('ip')).toBe('');
    expect(data.get('description.tr')).toBe('');
    expect(data.get('description.en')).toBe('');
  });

  it('shows a taken address and a taken code next to their fields and keeps what was typed', async () => {
    action.mockResolvedValue({
      status: 'error',
      code: 'taken',
      fieldErrors: { slug: { code: 'taken' }, code: { code: 'taken' } },
    });
    setup();
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'AV-1' } });
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'chandelier' } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!);
    });
    const data = action.mock.calls[0]![1];
    expect(data.get('slug')).toBe('chandelier');
    expect(data.get('code')).toBe('AV-1');
    expect(data.get('categoryId')).toBe('c1');
    expect(screen.getAllByText('This value is used by another item.')).toHaveLength(3);
    expect(screen.getByLabelText('Address').getAttribute('aria-invalid')).toBe('true');
    expect((screen.getByLabelText('Code') as HTMLInputElement).value).toBe('AV-1');
    expect((screen.getByLabelText('Address') as HTMLInputElement).value).toBe('chandelier');
  });
});
