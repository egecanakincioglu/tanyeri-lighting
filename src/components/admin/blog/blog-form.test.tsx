import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormState } from '../../../server/admin/form.ts';
import { axeViolations } from '../../../test/axe.ts';
import { getTranslations } from '../../../test/translations.ts';
import { buildFormTexts } from '../texts.ts';
import { BlogForm } from './blog-form.tsx';

const formTexts = buildFormTexts(await getTranslations({ locale: 'en', namespace: 'AdminForm' }));
const media = await getTranslations({ locale: 'en', namespace: 'AdminMedia' });
const markdown = await getTranslations({ locale: 'en', namespace: 'AdminMarkdown' });
const mediaTexts = {
  choose: media('choose'),
  replace: media('replace'),
  clear: media('clear'),
  uploading: media('uploading'),
  none: media('none'),
  hint: media('imageHint'),
  open: media('open'),
};
const markdownTexts = {
  hint: markdown('hint'),
  edit: markdown('edit'),
  preview: markdown('preview'),
  loading: markdown('loading'),
};
const texts = {
  image: 'Image',
  imageAlt: 'Image description',
  title: 'Title',
  description: 'Page description',
  excerpt: 'Summary',
  body: 'Text',
  slug: 'Address',
  slugHint: 'Lowercase letters.',
  slugRedirectHint: 'If you change it, the old address redirects.',
  publishedAt: 'Publication date',
  publishedAtHint: 'Leave empty for a draft.',
  cancel: 'Cancel',
};
const pair = (tr: string, en: string) => ({ tr, en });
const initial = {
  id: 'p1',
  slug: 'linear-lighting',
  imageUrl: '/demo/product-kare-sarkit.webp',
  imageAlt: pair('Görsel', 'Picture'),
  title: pair('Lineer aydınlatma', 'Linear lighting'),
  description: pair('Açıklama', 'Description'),
  excerpt: pair('Özet', 'Excerpt'),
  body: pair('Metin', 'Text body'),
  publishedAt: '2026-03-01',
};

const action = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();
const upload = vi.fn<(address: string, kind: 'image' | 'file') => Promise<FormState>>();

function setup(props: { initial?: typeof initial; readOnlyReason?: string } = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{}}>
      <BlogForm
        action={action}
        upload={upload}
        locale="en"
        texts={texts}
        formTexts={formTexts}
        mediaTexts={mediaTexts}
        markdownTexts={markdownTexts}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

async function submit() {
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!);
  });
}

describe('BlogForm', () => {
  beforeEach(() => {
    action.mockClear();
    action.mockResolvedValue({ status: 'success' });
  });
  afterEach(cleanup);

  it('starts empty on the create page, without an id, as a draft', () => {
    const { container } = setup();
    expect(container.querySelector('input[name="id"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[name="publishedAt"]')!.value).toBe('');
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/en/admin/blog');
    expect(screen.queryByText(/old address redirects/)).toBeNull();
  });

  it('follows the Turkish title with the address until the address is edited by hand', () => {
    const { container } = setup();
    const title = container.querySelector<HTMLInputElement>('input[name="title.tr"]')!;
    const slug = container.querySelector<HTMLInputElement>('input[name="slug"]')!;
    fireEvent.input(title, { target: { value: 'Gömme Spot Nasıl Seçilir?' } });
    expect(slug.value).toBe('gomme-spot-nasil-secilir');
    fireEvent.change(slug, { target: { value: 'my-own' } });
    fireEvent.input(title, { target: { value: 'Başka başlık' } });
    expect(slug.value).toBe('my-own');
  });

  it('never rewrites the stored address of an article and warns about changing it', () => {
    const { container } = setup({ initial });
    fireEvent.input(container.querySelector('input[name="title.tr"]')!, { target: { value: 'Yeni başlık' } });
    expect(container.querySelector<HTMLInputElement>('input[name="slug"]')!.value).toBe('linear-lighting');
    expect(screen.getByText(/old address redirects/)).toBeTruthy();
  });

  it('sends the stored values as the action input', async () => {
    setup({ initial });
    await submit();
    expect(Object.fromEntries(action.mock.calls[0]![1].entries())).toEqual({
      locale: 'en',
      id: 'p1',
      slug: 'linear-lighting',
      imageUrl: '/demo/product-kare-sarkit.webp',
      'imageAlt.tr': 'Görsel',
      'imageAlt.en': 'Picture',
      'title.tr': 'Lineer aydınlatma',
      'title.en': 'Linear lighting',
      publishedAt: '2026-03-01',
      'description.tr': 'Açıklama',
      'description.en': 'Description',
      'excerpt.tr': 'Özet',
      'excerpt.en': 'Excerpt',
      'body.tr': 'Metin',
      'body.en': 'Text body',
    });
  });

  it('shows the errors of the address and the date and keeps what was typed', async () => {
    action.mockResolvedValue({
      status: 'error',
      code: 'taken',
      fieldErrors: { slug: { code: 'taken' }, publishedAt: { code: 'invalid' } },
    });
    const { container } = setup({ initial });
    fireEvent.change(container.querySelector('input[name="slug"]')!, { target: { value: 'typed-slug' } });
    await submit();
    expect(document.getElementById('slug-error')).toBeTruthy();
    expect(document.getElementById('publishedAt-error')).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>('input[name="slug"]')!.value).toBe('typed-slug');
  });

  it('turns save off in the demo and says why', () => {
    setup({ initial, readOnlyReason: 'Off in the demo.' });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText('Off in the demo.').length).toBeGreaterThan(0);
  });

  it('has no axe violations', async () => {
    const { container } = setup({ initial });
    expect(await axeViolations(container)).toEqual([]);
  });
});
