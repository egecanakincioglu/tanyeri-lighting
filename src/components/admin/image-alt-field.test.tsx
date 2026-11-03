import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import { getTranslations } from '../../test/translations.ts';
import { ImageAltField } from './image-alt-field.tsx';
import { buildFormTexts } from './texts.ts';

const texts = buildFormTexts(await getTranslations({ locale: 'en', namespace: 'AdminForm' }));

describe('ImageAltField', () => {
  afterEach(cleanup);

  it('shows an optional pair with the stored values, the limit and the hint', () => {
    const { container } = render(
      <ImageAltField texts={texts} defaultValue={{ tr: 'Bir oda', en: 'A room' }} errors={{}} />,
    );
    const tr = container.querySelector<HTMLInputElement>('input[name="imageAlt.tr"]')!;
    const en = container.querySelector<HTMLInputElement>('input[name="imageAlt.en"]')!;
    expect([tr.value, en.value]).toEqual(['Bir oda', 'A room']);
    expect([tr.required, en.required]).toEqual([false, false]);
    expect([tr.maxLength, en.maxLength]).toEqual([200, 200]);
    expect(screen.getByText('Image description')).toBeTruthy();
    expect(screen.getByText(texts.imageAlt.hint)).toBeTruthy();
  });

  it('starts empty without stored values', () => {
    const { container } = render(<ImageAltField texts={texts} errors={{}} />);
    expect(container.querySelector<HTMLInputElement>('input[name="imageAlt.en"]')!.value).toBe('');
  });

  it('explains a half-filled pair under the pair as a whole', () => {
    render(<ImageAltField texts={texts} errors={{ imageAlt: { code: 'invalid' } }} />);
    expect(document.getElementById('imageAlt-error')?.textContent).toBe(texts.imageAlt.both);
  });

  it('shows the error of one language under its own input', () => {
    render(<ImageAltField texts={texts} errors={{ 'imageAlt.en': { code: 'tooLong', max: 200 } }} />);
    expect(document.getElementById('imageAlt-en-error')?.textContent).toBe('At most 200 characters.');
    expect(document.getElementById('imageAlt-error')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ImageAltField texts={texts} errors={{}} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});
