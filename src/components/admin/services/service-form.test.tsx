import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormState } from '../../../server/admin/form.ts';
import { axeViolations } from '../../../test/axe.ts';
import { getTranslations } from '../../../test/translations.ts';
import { buildFormTexts } from '../texts.ts';
import { ServiceForm } from './service-form.tsx';

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
  title: 'Title',
  description: 'Description',
  note: 'Note',
  noteHint: 'Optional.',
  noteBoth: 'Fill in the note in both languages, or leave both empty.',
  cancel: 'Cancel',
};
const initial = {
  id: 's1',
  imageUrl: '/demo/area-otel.webp',
  imageAlt: { tr: 'Otel lobisi', en: 'A hotel lobby' },
  title: { tr: 'Aydınlatma', en: 'Lighting' },
  description: { tr: 'Açıklama', en: 'Description text' },
  note: { tr: '', en: '' },
};

const action = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();
const upload = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();

function setup(props: { initial?: typeof initial; readOnlyReason?: string } = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{}}>
      <ServiceForm
        action={action}
        upload={upload}
        locale="en"
        texts={texts}
        formTexts={formTexts}
        mediaTexts={mediaTexts}
        markdownTexts={markdownTexts}
        maxBytes={4 * 1024 * 1024}
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

describe('ServiceForm', () => {
  beforeEach(() => {
    action.mockClear();
    action.mockResolvedValue({ status: 'success' });
  });
  afterEach(cleanup);

  it('starts empty on the create page, without an id, and the note is optional', () => {
    const { container } = setup();
    expect(container.querySelector('input[name="id"]')).toBeNull();
    expect((container.querySelector('input[name="locale"]') as HTMLInputElement).value).toBe('en');
    expect(container.querySelector<HTMLInputElement>('input[name="note.tr"]')!.required).toBe(false);
    expect(container.querySelector<HTMLInputElement>('input[name="title.tr"]')!.required).toBe(true);
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/en/admin/services');
  });

  it('sends the stored values, an empty note included, as the action input', async () => {
    setup({ initial });
    await submit();
    expect(Object.fromEntries(action.mock.calls[0]![1].entries())).toEqual({
      locale: 'en',
      id: 's1',
      imageUrl: '/demo/area-otel.webp',
      'imageAlt.tr': 'Otel lobisi',
      'imageAlt.en': 'A hotel lobby',
      'title.tr': 'Aydınlatma',
      'title.en': 'Lighting',
      'description.tr': 'Açıklama',
      'description.en': 'Description text',
      'note.tr': '',
      'note.en': '',
    });
  });

  it('explains a half-filled note and keeps what was typed', async () => {
    action.mockResolvedValue({ status: 'error', code: 'invalid', fieldErrors: { note: { code: 'invalid' } } });
    const { container } = setup({ initial });
    fireEvent.change(container.querySelector('input[name="note.tr"]')!, { target: { value: 'Yalnız Türkçe' } });
    await submit();
    expect(document.getElementById('note-error')?.textContent).toBe(texts.noteBoth);
    expect(container.querySelector<HTMLInputElement>('input[name="note.tr"]')!.value).toBe('Yalnız Türkçe');
  });

  it('keeps the image description optional and explains a half-filled one', async () => {
    action.mockResolvedValue({ status: 'error', code: 'invalid', fieldErrors: { imageAlt: { code: 'invalid' } } });
    const { container } = setup();
    expect(container.querySelector<HTMLInputElement>('input[name="imageAlt.tr"]')!.required).toBe(false);
    fireEvent.change(container.querySelector('input[name="imageAlt.en"]')!, { target: { value: 'Only English' } });
    await submit();
    expect(document.getElementById('imageAlt-error')?.textContent).toBe(formTexts.imageAlt.both);
    expect(container.querySelector<HTMLInputElement>('input[name="imageAlt.en"]')!.value).toBe('Only English');
  });

  it('shows the error under a long title', async () => {
    action.mockResolvedValue({
      status: 'error',
      code: 'invalid',
      fieldErrors: { 'title.en': { code: 'tooLong', max: 100 } },
    });
    setup({ initial });
    await submit();
    expect(document.getElementById('title-en-error')?.textContent).toBe('At most 100 characters.');
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
