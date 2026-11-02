import { getTranslations } from 'next-intl/server';
import { isDemoMode } from '../../../server/env.ts';
import { buildFormTexts } from '../texts.ts';

/** What both category pages (create and edit) pass to the form besides the action and the stored values. */
export async function categoryFormProps(locale: 'tr' | 'en') {
  const [t, form] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminCategories' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
  ]);
  const formTexts = buildFormTexts(form);
  return {
    locale,
    formTexts,
    readOnlyReason: isDemoMode() ? formTexts.demoNote : undefined,
    texts: { key: t('fieldKey'), keyHint: t('keyHint'), name: t('fieldName'), cancel: form('cancel') },
  };
}
