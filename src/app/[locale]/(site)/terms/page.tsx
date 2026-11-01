import type { Metadata } from 'next';
import { legalMetadata, renderLegalPage } from '../legal-route.tsx';

export async function generateMetadata({ params }: PageProps<'/[locale]/terms'>): Promise<Metadata> {
  return legalMetadata('terms', (await params).locale);
}

export default async function TermsPage({ params }: PageProps<'/[locale]/terms'>) {
  return renderLegalPage('terms', (await params).locale);
}
