import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SettingsForm } from '../../../../../../components/admin/corporate/settings-form.tsx';
import { SocialLinksEditor } from '../../../../../../components/admin/corporate/social-links-editor.tsx';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { buildFormTexts } from '../../../../../../components/admin/texts.ts';
import { routing } from '../../../../../../i18n/routing.ts';
import {
  createSocialLinkAction,
  deleteSocialLinkAction,
  reorderSocialLinksAction,
  updateSiteSettingsAction,
  updateSocialLinkAction,
} from '../../../../../../server/admin/corporate-actions.ts';
import { finalizeMediaAction } from '../../../../../../server/admin/upload-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { getSiteSettings } from '../../../../../../server/content/site-settings.ts';
import { listSocialLinks } from '../../../../../../server/content/social-links.ts';
import { isDemoMode } from '../../../../../../server/env.ts';
import { isStorageEnabled } from '../../../../../../server/storage/index.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/settings'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminSettings' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function SettingsAdminPage({ params }: PageProps<'/[locale]/dashboard/settings'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, media, settings, links] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminSettings' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    getTranslations({ locale, namespace: 'AdminMedia' }),
    getSiteSettings(),
    listSocialLinks(),
  ]);
  const formTexts = buildFormTexts(form);
  const readOnlyReason = isDemoMode() ? formTexts.demoNote : undefined;

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="flex flex-col gap-10">
        <SettingsForm
          action={updateSiteSettingsAction}
          upload={finalizeMediaAction}
          initial={settings}
          formTexts={formTexts}
          readOnlyReason={readOnlyReason}
          uploadDisabledReason={isStorageEnabled() ? undefined : media('storageOff')}
          texts={{
            logo: t('fieldLogo'),
            logoHint: t('fieldLogoHint'),
            siteName: t('fieldSiteName'),
            phone: t('fieldPhone'),
            email: t('fieldEmail'),
            address: t('fieldAddress'),
            workingHours: t('fieldWorkingHours'),
            serviceArea: t('fieldServiceArea'),
            languages: t('fieldLanguages'),
            business: t('sectionBusiness'),
            contact: t('sectionContact'),
          }}
          mediaTexts={{
            choose: media('choose'),
            replace: media('replace'),
            clear: media('clear'),
            uploading: media('uploading'),
            none: media('none'),
            hint: media('imageHint'),
            open: media('open'),
          }}
        />
        <SocialLinksEditor
          links={links}
          locale={locale}
          createAction={createSocialLinkAction}
          updateAction={updateSocialLinkAction}
          deleteAction={deleteSocialLinkAction}
          reorder={reorderSocialLinksAction}
          formTexts={formTexts}
          disabledReason={readOnlyReason}
          texts={{
            title: t('socialTitle'),
            description: t('socialDescription'),
            empty: t('socialEmpty'),
            add: t('socialAdd'),
            platform: t('socialPlatform'),
            platformHint: t('socialPlatformHint'),
            label: t('socialLabel'),
            url: t('socialUrl'),
            moveUp: t('moveUp'),
            moveDown: t('moveDown'),
            reordered: t('reordered'),
            delete: {
              trigger: t('delete'),
              title: t('deleteTitle'),
              body: t('deleteBody', { name: '{name}' }),
              confirm: t('deleteConfirm'),
              working: t('deleting'),
              cancel: form('cancel'),
            },
          }}
        />
      </div>
    </>
  );
}
