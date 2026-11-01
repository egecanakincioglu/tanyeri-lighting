import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-(--gutter) py-8">
      <h1 className="text-3xl lg:text-4xl">{t('title')}</h1>
    </div>
  );
}
