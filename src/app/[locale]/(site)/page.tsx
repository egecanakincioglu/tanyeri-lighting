import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('Home');

  return (
    <main>
      <h1>Tanyeri</h1>
      <p>{t('placeholder')}</p>
    </main>
  );
}
