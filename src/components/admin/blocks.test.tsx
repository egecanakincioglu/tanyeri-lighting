import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import { BilingualField } from './bilingual-field.tsx';
import { FormStatus } from './form-status.tsx';
import { PageHeader } from './page-header.tsx';
import { SubmitButton } from './submit-button.tsx';
import { buildFormTexts, fieldMessage } from './texts.ts';
import { getTranslations } from '../../test/translations.ts';

afterEach(cleanup);

const languages = { tr: 'Türkçe', en: 'English' };
const statusTexts = { saved: 'Saved.', errors: { demo: 'Demo.', generic: 'Wrong.' } } as never;

describe('PageHeader', () => {
  it('shows the title as the heading, the description and the action', () => {
    render(<PageHeader title="References" description="The work." action={<button type="button">New</button>} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('References');
    expect(screen.getByText('The work.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New' })).toBeTruthy();
  });

  it('works with the title alone', () => {
    render(<PageHeader title="Only" />);
    expect(screen.getByRole('heading', { name: 'Only' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('FormStatus', () => {
  it('says nothing before a submit, in two live regions', () => {
    render(<FormStatus state={null} texts={statusTexts} />);
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('announces success in the status region, with the default or a custom text', () => {
    const { rerender } = render(<FormStatus state={{ status: 'success' }} texts={statusTexts} />);
    expect(screen.getByRole('status').textContent).toBe('Saved.');
    rerender(<FormStatus state={{ status: 'success' }} texts={statusTexts} successText="Order saved." />);
    expect(screen.getByRole('status').textContent).toBe('Order saved.');
    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('announces a failure in the alert region', () => {
    render(<FormStatus state={{ status: 'error', code: 'demo', fieldErrors: {} }} texts={statusTexts} />);
    expect(screen.getByRole('alert').textContent).toBe('Demo.');
    expect(screen.getByRole('status').textContent).toBe('');
  });
});

describe('SubmitButton', () => {
  it('is a submit button with its label', () => {
    render(
      <form>
        <SubmitButton label="Save" pendingLabel="Saving…" />
      </form>,
    );
    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.type).toBe('submit');
    expect(button.disabled).toBe(false);
  });

  it('shows the pending label and is off while a submit from code runs', () => {
    render(
      <form>
        <SubmitButton label="Save" pendingLabel="Saving…" pending />
      </form>,
    );
    const button = screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('can be switched off', () => {
    render(<SubmitButton label="Save" pendingLabel="Saving…" disabled />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('BilingualField', () => {
  it('shows one required input per language, named by language, under one group name', () => {
    render(
      <BilingualField
        name="title"
        label="Kind of work"
        languages={languages}
        defaultValue={{ tr: 'Otel', en: 'Hotel' }}
        maxLength={100}
      />,
    );
    expect(screen.getByRole('group', { name: 'Kind of work' })).toBeTruthy();
    const tr = screen.getByLabelText('Türkçe') as HTMLInputElement;
    const en = screen.getByLabelText('English') as HTMLInputElement;
    expect([tr.name, en.name]).toEqual(['title.tr', 'title.en']);
    expect([tr.value, en.value]).toEqual(['Otel', 'Hotel']);
    expect([tr.required, en.required, tr.maxLength, en.maxLength]).toEqual([true, true, 100, 100]);
    expect(tr.lang).toBe('tr');
  });

  it('can be a text area and starts empty without a value', () => {
    render(<BilingualField name="description" label="Description" languages={languages} multiline />);
    const tr = screen.getByLabelText('Türkçe');
    expect(tr.tagName).toBe('TEXTAREA');
    expect((tr as HTMLTextAreaElement).value).toBe('');
  });

  it('shows the error of one language next to its input only', () => {
    render(
      <BilingualField name="title" label="Title" languages={languages} errors={{ en: 'This field is required.' }} />,
    );
    expect(screen.getByLabelText('English').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Türkçe').getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByLabelText('English').getAttribute('aria-describedby')).toBe('title-en-error');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <BilingualField name="title" label="Title" languages={languages} errors={{ tr: 'Required.' }} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('texts', () => {
  it('builds the shared form texts from the AdminForm messages and fills {max}', async () => {
    const t = await getTranslations({ locale: 'en', namespace: 'AdminForm' });
    const texts = buildFormTexts(t);
    expect(texts.save).toBe('Save');
    expect(texts.languages).toEqual({ tr: 'Turkish', en: 'English' });
    expect(Object.keys(texts.errors)).toHaveLength(14);
    expect(Object.values(texts.errors).every(Boolean)).toBe(true);
    expect(fieldMessage(texts, { code: 'required' })).toBe('This field is required.');
    expect(fieldMessage(texts, { code: 'tooLong', max: 100 })).toBe('At most 100 characters.');
    expect(fieldMessage(texts, { code: 'invalid' })).toBeTruthy();
    expect(fieldMessage(texts, { code: 'taken' })).toBe('This value is used by another item.');
    expect(fieldMessage(texts, undefined)).toBeUndefined();
  });

  it('holds only strings, so a server page can pass the texts to a client component', async () => {
    const t = await getTranslations({ locale: 'tr', namespace: 'AdminForm' });
    const leaves = (value: unknown): unknown[] =>
      typeof value === 'object' && value !== null ? Object.values(value).flatMap(leaves) : [value];
    const all = leaves(buildFormTexts(t));
    expect(all.length).toBeGreaterThan(10);
    expect(all.every((leaf) => typeof leaf === 'string' && leaf !== '')).toBe(true);
  });
});
