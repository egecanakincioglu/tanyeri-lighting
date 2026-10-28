import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('Home');

  return (
    <main className="p-4">
      <h1 className="text-2xl font-semibold">Tanyeri</h1>
      <p>{t('placeholder')}</p>
    </main>
  );
}
