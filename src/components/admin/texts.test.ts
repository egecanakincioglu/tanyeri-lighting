import { describe, expect, it } from 'vitest';
import { getTranslations } from '../../test/translations.ts';
import { buildFormTexts, fieldMessage } from './texts.ts';

describe('buildFormTexts', () => {
  it.each(['en', 'tr'])('keeps the {max} placeholder of the too-long text for the browser in %s', async (locale) => {
    const texts = buildFormTexts(await getTranslations({ locale, namespace: 'AdminForm' }));
    expect(texts.fieldErrors.tooLong).toContain('{max}');
    const shown = fieldMessage(texts, { code: 'tooLong', max: 120 });
    expect(shown).toContain('120');
    expect(shown).not.toContain('{');
  });
});
