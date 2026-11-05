import { getTranslations } from 'next-intl/server';
import { finalizeMediaAction } from '../../../server/admin/upload-actions.ts';
import { isDemoMode } from '../../../server/env.ts';
import { isStorageEnabled } from '../../../server/storage/index.ts';
import { buildFormTexts } from '../texts.ts';

export async function blogFormProps(locale: 'tr' | 'en') {
  const [t, form, media, markdown] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminBlog' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    getTranslations({ locale, namespace: 'AdminMedia' }),
    getTranslations({ locale, namespace: 'AdminMarkdown' }),
  ]);
  const formTexts = buildFormTexts(form);
  return {
    locale,
    upload: finalizeMediaAction,
    formTexts,
    readOnlyReason: isDemoMode() ? formTexts.demoNote : undefined,
    uploadDisabledReason: isStorageEnabled() ? undefined : media('storageOff'),
    texts: {
      image: t('fieldImage'),
      imageAlt: t('fieldImageAlt'),
      title: t('fieldTitle'),
      description: t('fieldDescription'),
      excerpt: t('fieldExcerpt'),
      body: t('fieldBody'),
      slug: t('fieldSlug'),
      slugHint: t('slugHint'),
      slugRedirectHint: t('slugRedirectHint'),
      publishedAt: t('fieldPublishedAt'),
      publishedAtHint: t('publishedAtHint'),
      cancel: form('cancel'),
    },
    mediaTexts: {
      choose: media('choose'),
      replace: media('replace'),
      clear: media('clear'),
      uploading: media('uploading'),
      none: media('none'),
      hint: media('imageHint'),
      open: media('open'),
    },
    markdownTexts: {
      hint: markdown('hint'),
      edit: markdown('edit'),
      preview: markdown('preview'),
      loading: markdown('loading'),
    },
  };
}
