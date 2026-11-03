import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormState } from '../../../server/admin/form.ts';
import { buildFormTexts } from '../texts.ts';
import { BannerForm } from './banner-form.tsx';

const formTexts = buildFormTexts((key) => key);
const mediaTexts = {
  choose: 'Choose',
  replace: 'Replace',
  clear: 'Clear',
  uploading: 'Uploading',
  none: 'None',
  hint: 'Hint',
  open: 'Open',
};
const texts = {
  image: 'Image',
  title: 'Title',
  description: 'Description',
  primaryLabel: 'First text',
  primaryTarget: 'First opens',
  secondaryLabel: 'Second text',
  secondaryTarget: 'Second opens',
};
const initial = {
  imageUrl: '/demo/banner.webp',
  imageAlt: { tr: 'Gece evi', en: 'A house at night' },
  title: { tr: 'Başlık', en: 'Title text' },
  description: { tr: 'Açıklama', en: 'Description text' },
  primaryAction: { label: { tr: 'Ürünler', en: 'Products' }, target: 'products' as const },
  secondaryAction: { label: { tr: 'İletişim', en: 'Contact' }, target: 'contact' as const },
};
const targets = [
  { value: 'products', label: 'Products' },
  { value: 'catalogs', label: 'Catalogs' },
  { value: 'contact', label: 'Contact' },
];

const action = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();
const upload = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();

function setup(readOnlyReason?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={{}}>
      <BannerForm
        action={action}
        upload={upload}
        initial={initial}
        targets={targets}
        texts={texts}
        formTexts={formTexts}
        mediaTexts={mediaTexts}
        maxBytes={1024}
        readOnlyReason={readOnlyReason}
      />
    </NextIntlClientProvider>,
  );
}

async function submit() {
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: 'save' }).closest('form')!);
  });
}

describe('BannerForm', () => {
  beforeEach(() => {
    action.mockClear();
    action.mockResolvedValue({ status: 'success' });
  });
  afterEach(cleanup);

  it('sends the whole banner, with the changed target of a button', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Second opens'), { target: { value: 'catalogs' } });
    await submit();
    expect(Object.fromEntries(action.mock.calls[0]![1].entries())).toEqual({
      imageUrl: '/demo/banner.webp',
      'imageAlt.tr': 'Gece evi',
      'imageAlt.en': 'A house at night',
      'title.tr': 'Başlık',
      'title.en': 'Title text',
      'description.tr': 'Açıklama',
      'description.en': 'Description text',
      'primaryLabel.tr': 'Ürünler',
      'primaryLabel.en': 'Products',
      primaryTarget: 'products',
      'secondaryLabel.tr': 'İletişim',
      'secondaryLabel.en': 'Contact',
      secondaryTarget: 'catalogs',
    });
  });

  it('shows the error under the field of a button and keeps what was typed', async () => {
    action.mockResolvedValue({
      status: 'error',
      code: 'invalid',
      fieldErrors: {
        'primaryAction.label.en': { code: 'tooLong', max: 40 },
        'secondaryAction.target': { code: 'invalid' },
      },
    });
    setup();
    fireEvent.change(document.getElementById('primaryLabel-en')!, {
      target: { value: 'Typed' },
    });
    await submit();
    expect(document.getElementById('primaryLabel-en-error')).not.toBeNull();
    expect(screen.getByLabelText('Second opens').getAttribute('aria-invalid')).toBe('true');
    expect((document.getElementById('primaryLabel-en') as HTMLInputElement).value).toBe('Typed');
  });

  it('turns save off in the demo', () => {
    setup('Off in the demo.');
    expect((screen.getByRole('button', { name: 'save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText('Off in the demo.').length).toBeGreaterThan(0);
  });
});
