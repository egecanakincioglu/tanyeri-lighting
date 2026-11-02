import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormState } from '../../../server/admin/form.ts';
import { axeViolations } from '../../../test/axe.ts';
import { getTranslations } from '../../../test/translations.ts';
import { buildFormTexts } from '../texts.ts';
import { ProjectForm } from './project-form.tsx';

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
const texts = { title: 'Title', description: 'Description', before: 'Before', after: 'After', cancel: 'Cancel' };
const initial = {
  id: 'p1',
  title: { tr: 'Villa', en: 'Villa' },
  description: { tr: 'Açıklama', en: 'Description text' },
  beforeImageUrl: '/demo/area-otel.webp',
  afterImageUrl: '/demo/area-otel.webp',
};

const action = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();
const upload = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();

function setup(props: { initial?: typeof initial; readOnlyReason?: string } = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{}}>
      <ProjectForm
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

describe('ProjectForm', () => {
  beforeEach(() => {
    action.mockClear();
    action.mockResolvedValue({ status: 'success' });
  });
  afterEach(cleanup);

  it('starts empty on the create page and links back to the list', () => {
    const { container } = setup();
    expect(container.querySelector('input[name="id"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[name="beforeImageUrl"]')!.value).toBe('');
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/en/admin/projects');
  });

  it('labels the two pictures and sends the stored values as the action input', async () => {
    setup({ initial });
    expect(screen.getByText('Before')).toBeTruthy();
    expect(screen.getByText('After')).toBeTruthy();
    await submit();
    expect(Object.fromEntries(action.mock.calls[0]![1].entries())).toEqual({
      locale: 'en',
      id: 'p1',
      'title.tr': 'Villa',
      'title.en': 'Villa',
      'description.tr': 'Açıklama',
      'description.en': 'Description text',
      beforeImageUrl: '/demo/area-otel.webp',
      afterImageUrl: '/demo/area-otel.webp',
    });
  });

  it('shows the errors under the fields and keeps what was typed', async () => {
    action.mockResolvedValue({
      status: 'error',
      code: 'invalid',
      fieldErrors: { 'title.tr': { code: 'required' }, afterImageUrl: { code: 'invalid' } },
    });
    const { container } = setup({ initial });
    fireEvent.change(container.querySelector('input[name="title.en"]')!, { target: { value: 'Typed' } });
    await submit();
    expect(document.getElementById('title-tr-error')?.textContent).toBe('This field is required.');
    expect(screen.getByText('Missing or invalid value.')).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>('input[name="title.en"]')!.value).toBe('Typed');
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
