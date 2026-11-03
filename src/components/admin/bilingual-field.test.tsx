import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import { BilingualField } from './bilingual-field.tsx';

afterEach(cleanup);

function setup() {
  return render(
    <BilingualField
      name="title"
      label="Title"
      languages={{ tr: 'Turkish', en: 'English' }}
      defaultValue={{ tr: 'Merhaba', en: 'Hello' }}
    />,
  );
}

describe('BilingualField', () => {
  it('keeps the input names the Server Actions read, with the language labels', () => {
    setup();
    expect(screen.getByLabelText<HTMLInputElement>('Turkish').name).toBe('title.tr');
    expect(screen.getByLabelText<HTMLInputElement>('English').name).toBe('title.en');
    expect(screen.getByRole('group', { name: 'Title' })).toBeTruthy();
  });

  it('marks the language of each input', () => {
    setup();
    expect(screen.getByLabelText('Turkish').getAttribute('lang')).toBe('tr');
    expect(screen.getByLabelText('English').getAttribute('lang')).toBe('en');
  });

  it('has no axe violations', async () => {
    const { container } = setup();
    expect(await axeViolations(container)).toEqual([]);
  });
});
