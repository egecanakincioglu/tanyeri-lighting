import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BilingualMarkdownField } from './bilingual-markdown-field.tsx';

const texts = { hint: 'Use ## for a heading.', edit: 'Edit', preview: 'Preview', loading: 'Loading…' };
const languages = { tr: 'Turkish', en: 'English' };

function setup(errors?: { tr?: string; en?: string }) {
  return render(
    <form>
      <BilingualMarkdownField
        name="description"
        label="Description"
        languages={languages}
        defaultValue={{ tr: 'Merhaba', en: 'Hello' }}
        maxLength={40}
        errors={errors}
        texts={texts}
      />
    </form>,
  );
}

describe('BilingualMarkdownField', () => {
  afterEach(cleanup);

  it('renders one editor per language under the group label, with the keys the actions read', () => {
    setup();
    expect(screen.getByRole('group', { name: 'Description' })).toBeTruthy();
    const tr = screen.getByLabelText('Turkish') as HTMLTextAreaElement;
    const en = screen.getByLabelText('English') as HTMLTextAreaElement;
    expect([tr.name, tr.value, tr.lang, tr.maxLength]).toEqual(['description.tr', 'Merhaba', 'tr', 40]);
    expect([en.name, en.value, en.lang, en.maxLength]).toEqual(['description.en', 'Hello', 'en', 40]);
  });

  it('passes each language error to its own editor only', () => {
    setup({ en: 'This field is required.' });
    expect(screen.getByLabelText('English').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Turkish').getAttribute('aria-invalid')).not.toBe('true');
  });
});
