import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import { MarkdownField } from './markdown-field.tsx';

const texts = {
  hint: 'Use ## for a heading.',
  edit: 'Edit',
  preview: 'Preview',
  loading: 'Loading…',
};

function setup(error?: string) {
  return render(
    <form>
      <MarkdownField
        id="body"
        name="body.tr"
        label="Text"
        defaultValue="Hello"
        maxLength={50}
        error={error}
        texts={texts}
      />
    </form>,
  );
}

describe('MarkdownField', () => {
  afterEach(cleanup);

  it('shows a text area with the hint and the limit', () => {
    setup();
    const area = screen.getByLabelText('Text') as HTMLTextAreaElement;
    expect([area.name, area.value, area.maxLength]).toEqual(['body.tr', 'Hello', 50]);
    expect(screen.getByText('Use ## for a heading.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the validation error on the text area', () => {
    setup('This field is required.');
    expect(screen.getByLabelText('Text').getAttribute('aria-invalid')).toBe('true');
  });

  it('renders what is typed with the public Markdown rules, and keeps the text in the form', async () => {
    const { container } = setup();
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: '## Title\n\n**bold** <b>raw</b>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const heading = await screen.findByRole('heading', { level: 2, name: 'Title' });
    expect(heading).toBeTruthy();
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    // Raw HTML is dropped like on the public pages.
    expect(container.querySelector('b')).toBeNull();
    expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toContain('## Title');
    expect(screen.getByRole('button', { name: 'Preview' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('goes back to the text area', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText('Hello', { selector: 'p' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect((screen.getByLabelText('Text') as HTMLTextAreaElement).closest('[hidden]')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = setup();
    expect(await axeViolations(container)).toEqual([]);
  });
});
