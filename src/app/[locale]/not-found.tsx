import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <main className="p-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
    </main>
  );
}
