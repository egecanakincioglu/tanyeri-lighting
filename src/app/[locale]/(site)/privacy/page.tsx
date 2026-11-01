import type { Metadata } from 'next';
import { legalMetadata, renderLegalPage } from '../legal-route.tsx';

export async function generateMetadata({ params }: PageProps<'/[locale]/privacy'>): Promise<Metadata> {
  return legalMetadata('privacy', (await params).locale);
}

export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
  return renderLegalPage('privacy', (await params).locale);
}
