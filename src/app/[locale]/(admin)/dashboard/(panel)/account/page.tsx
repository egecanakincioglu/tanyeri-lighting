import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import {
  EmailForm,
  PasswordForm,
  type AccountTexts,
} from '../../../../../../components/admin/account/account-forms.tsx';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { routing } from '../../../../../../i18n/routing.ts';
import { changeEmailAction, changePasswordAction } from '../../../../../../server/admin/account-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { isDemoMode, isEmailEnabled } from '../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/account'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminAccount' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: PageProps<'/[locale]/dashboard/account'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const session = await guardPage(locale);
  const t = await getTranslations({ locale, namespace: 'AdminAccount' });
  const texts: AccountTexts = {
    errors: {
      invalid: t('errors.invalid'),
      demo: t('errors.demo'),
      unauthorized: t('errors.unauthorized'),
      rateLimited: t('errors.rateLimited'),
      emailOff: t('errors.emailOff'),
      generic: t('errors.generic'),
    },
    issues: {
      required: t('issues.required'),
      wrongCurrent: t('issues.wrongCurrent'),
      tooShort: t('issues.tooShort'),
      tooLong: t('issues.tooLong'),
      mismatch: t('issues.mismatch'),
      invalid: t('issues.invalid'),
      same: t('issues.same'),
    },
  };
  const demo = isDemoMode();
  const emailReason = demo ? t('demoNote') : isEmailEnabled() ? undefined : t('emailOffNote');

  return (
    <>
      <PageHeader
        title={t('title')}
        description={`${t('description')} ${t('signedInAs', { email: session.user.email })}`}
      />
      <div className="grid max-w-2xl gap-6">
        <PasswordForm
          action={changePasswordAction}
          texts={texts}
          title={t('passTitle')}
          button={t('passButton')}
          working={t('passWorking')}
          done={t('passDone')}
          disabledReason={demo ? t('demoNote') : undefined}
          labels={{ current: t('currentLabel'), next: t('newLabel'), confirm: t('confirmLabel') }}
          hint={t('passHint')}
        />
        <EmailForm
          action={changeEmailAction}
          locale={locale}
          texts={texts}
          title={t('emailTitle')}
          button={t('emailButton')}
          working={t('emailWorking')}
          done={t('emailDone')}
          disabledReason={emailReason}
          label={t('emailLabel')}
          hint={t('emailHint')}
        />
      </div>
    </>
  );
}
