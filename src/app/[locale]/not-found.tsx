import { useTranslations } from 'next-intl';
import { Logo } from '../../components/logo.tsx';

export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <main className="mx-auto flex w-full max-w-page flex-col gap-6 px-(--gutter) py-8">
      <Logo label="Tanyeri Lighting" />
      <h1 className="text-3xl lg:text-4xl">{t('title')}</h1>
    </main>
  );
}
