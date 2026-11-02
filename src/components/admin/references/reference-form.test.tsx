import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormState } from '../../../server/admin/form.ts';
import { axeViolations } from '../../../test/axe.ts';
import { getTranslations } from '../../../test/translations.ts';
import { buildFormTexts } from '../texts.ts';
import { ReferenceForm } from './reference-form.tsx';

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
  name: 'Company name',
  title: 'Kind of work',
  description: 'Description',
  cancel: 'Cancel',
};
const initial = {
  id: 'r1',
  imageUrl: '/demo/area-otel.webp',
  name: 'Alpha Hotel',
  title: { tr: 'Otel', en: 'Hotel' },
  description: { tr: 'Açıklama', en: 'Description text' },
};

const action = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();
const upload = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();

function setup(props: { initial?: typeof initial; readOnlyReason?: string; uploadDisabledReason?: string } = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{}}>
      <ReferenceForm
        action={action}
        upload={upload}
        locale="en"
        texts={texts}
        formTexts={formTexts}
        mediaTexts={mediaTexts}
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

describe('ReferenceForm', () => {
  beforeEach(() => {
    action.mockClear();
    action.mockResolvedValue({ status: 'success' });
  });
  afterEach(cleanup);

  it('starts empty on the create page, with the language in a hidden field and no id', () => {
    const { container } = setup();
    expect((screen.getByLabelText('Company name') as HTMLInputElement).value).toBe('');
    expect((container.querySelector('input[name="locale"]') as HTMLInputElement).value).toBe('en');
    expect(container.querySelector('input[name="id"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/en/admin/references');
  });

  it('is filled with the stored values on the edit page and sends them as the action input', async () => {
    const { container } = setup({ initial });
    expect((container.querySelector('input[name="id"]') as HTMLInputElement).value).toBe('r1');
    await submit();
    expect(action).toHaveBeenCalledTimes(1);
    const sent = action.mock.calls[0]![1];
    expect(Object.fromEntries(sent.entries())).toEqual({
      locale: 'en',
      id: 'r1',
      imageUrl: '/demo/area-otel.webp',
      name: 'Alpha Hotel',
      'title.tr': 'Otel',
      'title.en': 'Hotel',
      'description.tr': 'Açıklama',
      'description.en': 'Description text',
    });
    expect(screen.getByRole('status').textContent).toBe('Saved.');
  });

  it('shows the error under each field and keeps what was typed when the server refuses', async () => {
    action.mockResolvedValue({
      status: 'error',
      code: 'invalid',
      fieldErrors: {
        name: { code: 'required' },
        'title.en': { code: 'tooLong', max: 100 },
        imageUrl: { code: 'invalid' },
      },
    });
    setup({ initial });
    fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Typed' } });
    await submit();
    expect(screen.getByLabelText('Company name').getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById('name-error')?.textContent).toBe('This field is required.');
    expect(document.getElementById('title-en-error')?.textContent).toBe('At most 100 characters.');
    expect(screen.getByText('Some fields need to be corrected.').closest('[role="alert"]')).not.toBeNull();
    expect((screen.getByLabelText('Company name') as HTMLInputElement).value).toBe('Typed');
  });

  it('turns save off in the demo and says why', () => {
    setup({ initial, readOnlyReason: 'Off in the demo.' });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText('Off in the demo.').length).toBeGreaterThan(0);
    expect((screen.getByLabelText('Company name') as HTMLInputElement).readOnly).toBe(false);
  });

  it('turns only the upload off when the file store is missing', () => {
    setup({ initial, uploadDisabledReason: 'No file store.' });
    expect((screen.getByRole('button', { name: 'Replace' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('No file store.')).toBeTruthy();
  });

  it('has no axe violations', async () => {
    const { container } = setup({ initial });
    expect(await axeViolations(container)).toEqual([]);
  });
});
