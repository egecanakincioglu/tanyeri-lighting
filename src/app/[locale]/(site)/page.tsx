import { useTranslations } from 'next-intl';
import { Logo } from '../../../components/logo.tsx';

export default function HomePage() {
  const t = useTranslations('Home');

  return (
    <main className="mx-auto flex max-w-page flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
      <Logo label="Tanyeri" variant="wordmark" />
      <h1 className="text-3xl lg:text-5xl">Tanyeri</h1>
      <p className="text-muted">{t('placeholder')}</p>
    </main>
  );
}
