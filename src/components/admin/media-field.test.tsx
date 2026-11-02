import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormState } from '../../server/admin/form.ts';
import { axeViolations } from '../../test/axe.ts';
import { getTranslations } from '../../test/translations.ts';
import { FileField, ImageField, type MediaTexts } from './media-field.tsx';
import { buildFormTexts } from './texts.ts';

const form = buildFormTexts(await getTranslations({ locale: 'en', namespace: 'AdminForm' }));
const texts: MediaTexts = {
  choose: 'Choose a file',
  replace: 'Replace',
  clear: 'Remove',
  uploading: 'Uploading…',
  none: 'No file chosen yet.',
  hint: 'JPEG, PNG or WebP, up to 4 MB.',
  open: 'Open the file',
};

const upload = vi.fn<(previous: FormState | null, formData: FormData) => Promise<FormState>>();

function setup(
  Field: typeof ImageField,
  props: { defaultValue?: string; disabledReason?: string; error?: string; maxBytes?: number } = {},
) {
  return render(
    <form>
      <Field
        id="pic"
        name="imageUrl"
        label="Image"
        upload={upload}
        texts={texts}
        errors={form.errors}
        maxBytes={100}
        {...props}
      />
    </form>,
  );
}

const hidden = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="hidden"]')!;
const fileInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!;

function choose(container: HTMLElement, file: File) {
  fireEvent.change(fileInput(container), { target: { files: [file] } });
}

describe('ImageField', () => {
  beforeEach(() => {
    upload.mockClear();
  });
  afterEach(cleanup);

  it('shows the current picture and sends its address with the form', () => {
    const { container } = setup(ImageField, { defaultValue: '/demo/area-otel.webp' });
    expect(hidden(container).name).toBe('imageUrl');
    expect(hidden(container).value).toBe('/demo/area-otel.webp');
    expect(container.querySelector('img')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
    expect(screen.getByText('JPEG, PNG or WebP, up to 4 MB.')).toBeTruthy();
  });

  it('shows the picture in an A4 portrait box when asked, and in a landscape box otherwise', () => {
    const { container } = render(
      <ImageField
        id="cover"
        name="coverImageUrl"
        label="Cover"
        defaultValue="/demo/area-otel.webp"
        upload={upload}
        texts={texts}
        errors={form.errors}
        maxBytes={100}
        portrait
      />,
    );
    expect(container.querySelector('img')!.parentElement!.className).toContain('aspect-[210/297]');
    expect(container.querySelector('img')!.getAttribute('sizes')).toBe('144px');
    cleanup();
    const landscape = setup(ImageField, { defaultValue: '/demo/area-otel.webp' });
    expect(landscape.container.querySelector('img')!.parentElement!.className).toContain('aspect-4/3');
    expect(landscape.container.querySelector('img')!.getAttribute('sizes')).toBe('192px');
  });

  it('says that nothing is chosen yet', () => {
    const { container } = setup(ImageField);
    expect(screen.getByText('No file chosen yet.')).toBeTruthy();
    expect(hidden(container).value).toBe('');
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('uploads the chosen picture and puts the returned address into the form', async () => {
    upload.mockResolvedValue({ status: 'success', url: 'https://store.example.com/new.webp' });
    const { container } = setup(ImageField);
    choose(container, new File(['x'], 'photo.png', { type: 'image/png' }));
    await waitFor(() => expect(hidden(container).value).toBe('https://store.example.com/new.webp'));
    const sent = upload.mock.calls[0]![1];
    expect(sent.get('file')).toBeInstanceOf(Blob);
    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('refuses a file over the limit or of another type without asking the server', () => {
    const { container } = setup(ImageField);
    choose(container, new File(['x'.repeat(101)], 'big.png', { type: 'image/png' }));
    expect(screen.getByRole('alert').textContent).toBe('The file can not be larger than 4 MB.');
    choose(container, new File(['x'], 'doc.txt', { type: 'text/plain' }));
    expect(screen.getByRole('alert').textContent).toBe('Only JPEG, PNG, WebP or PDF files can be uploaded.');
    expect(upload).not.toHaveBeenCalled();
  });

  it('turns a rejection by the server into a readable message and keeps the old picture', async () => {
    upload.mockResolvedValue({ status: 'error', code: 'unreadableImage', fieldErrors: {} });
    const { container } = setup(ImageField, { defaultValue: '/demo/area-otel.webp' });
    choose(container, new File(['x'], 'a.png', { type: 'image/png' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('The image could not be opened. Try another file.'),
    );
    expect(hidden(container).value).toBe('/demo/area-otel.webp');
  });

  it('clears the picture', () => {
    const { container } = setup(ImageField, { defaultValue: '/demo/area-otel.webp' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(hidden(container).value).toBe('');
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the validation error of the form', () => {
    setup(ImageField, { error: 'This field is required.' });
    expect(screen.getByRole('alert').textContent).toBe('This field is required.');
  });

  it('is off with a reason when uploads are not possible, and keeps the current picture', () => {
    const { container } = setup(ImageField, {
      defaultValue: '/demo/area-otel.webp',
      disabledReason: 'File upload is off on this site.',
    });
    expect(screen.getByText('File upload is off on this site.')).toBeTruthy();
    for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(fileInput(container).disabled).toBe(true);
    expect(hidden(container).value).toBe('/demo/area-otel.webp');
  });

  it('has no axe violations', async () => {
    const { container } = setup(ImageField, { defaultValue: '/demo/area-otel.webp', error: 'Required.' });
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('FileField', () => {
  afterEach(cleanup);

  it('links to the stored file instead of showing a picture', () => {
    const { container } = setup(FileField, { defaultValue: 'https://store.example.com/catalog.pdf' });
    const link = screen.getByRole('link', { name: 'Open the file' });
    expect(link.getAttribute('href')).toBe('https://store.example.com/catalog.pdf');
    expect(link.getAttribute('rel')).toBe('noopener');
    expect(container.querySelector('img')).toBeNull();
    expect(fileInput(container).accept).toBe('application/pdf');
  });

  it('says that nothing is chosen yet and accepts only PDF files', () => {
    const { container } = setup(FileField);
    expect(screen.getByText('No file chosen yet.')).toBeTruthy();
    choose(container, new File(['x'], 'a.png', { type: 'image/png' }));
    expect(screen.getByRole('alert').textContent).toBe('Only JPEG, PNG, WebP or PDF files can be uploaded.');
  });

  it('has no axe violations', async () => {
    const { container } = setup(FileField, { defaultValue: 'https://store.example.com/catalog.pdf' });
    expect(await axeViolations(container)).toEqual([]);
  });
});
