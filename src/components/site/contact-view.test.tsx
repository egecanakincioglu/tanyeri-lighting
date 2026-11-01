import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../../messages/en.json' with { type: 'json' };
import tr from '../../../messages/tr.json' with { type: 'json' };
import type { SiteSettings } from '../../server/content/schemas.ts';
import { axeViolations } from '../../test/axe.ts';
import { ContactView } from './contact-view.tsx';

const pair = (trText: string, enText: string) => ({ tr: trText, en: enText });

const settings: SiteSettings = {
  siteName: pair('Tanyeri Lighting', 'Tanyeri Lighting'),
  logoUrl: null,
  phone: '+90 212 000 00 00',
  email: 'info@tanyeri.example',
  address: pair('Örnek Mah. Aydınlatma Cad. No: 12', 'Example Street 12'),
  workingHours: pair('Pazartesi - Cuma 09.00 - 18.00', 'Monday - Friday 09:00 - 18:00'),
  serviceArea: pair('Türkiye', 'Turkey'),
  languages: pair('Türkçe', 'Turkish'),
};

const emptySettings: SiteSettings = {
  ...settings,
  phone: '',
  email: '',
  address: pair('', ''),
  workingHours: pair('', ''),
};

const props = {
  action: async () => ({ status: 'ok' }) as const,
  honeypotName: 'website',
  limits: { name: 100, email: 254, subject: 150, message: 5000 },
};

function view(locale: 'tr' | 'en', data: SiteSettings, product?: { name: string; code: string }) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'tr' ? tr : en}>
      <ContactView settings={data} product={product} {...props} />
    </NextIntlClientProvider>,
  );
}

describe('ContactView', () => {
  afterEach(cleanup);

  it.each([
    ['tr', 'İletişim', 'Mesaj gönder', 'Pazartesi - Cuma 09.00 - 18.00'],
    ['en', 'Contact', 'Send message', 'Monday - Friday 09:00 - 18:00'],
  ] as const)('renders the title as the single h1, the details and the form for %s', (locale, title, send, hours) => {
    view(locale, settings);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title);
    expect(screen.getByRole('button', { name: send })).toBeTruthy();
    expect(screen.getByText(hours)).toBeTruthy();
  });

  it('links the phone and the email and shows the address in the visitor language', () => {
    view('en', settings);
    expect(screen.getByRole('link', { name: '+90 212 000 00 00' }).getAttribute('href')).toBe('tel:+902120000000');
    expect(screen.getByRole('link', { name: 'info@tanyeri.example' }).getAttribute('href')).toBe(
      'mailto:info@tanyeri.example',
    );
    expect(screen.getByText('Example Street 12')).toBeTruthy();
    expect(screen.queryByText('Örnek Mah. Aydınlatma Cad. No: 12')).toBeNull();
  });

  it('leaves out the details that are empty', () => {
    view('en', emptySettings);
    expect(screen.queryByText('Phone')).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Send message' })).toBeTruthy();
  });

  it.each([
    ['tr', 'Ürün hakkında bilgi: Ray Spot (RS-12)', 'Konu'],
    ['en', 'Product enquiry: Ray Spot (RS-12)', 'Subject'],
  ] as const)('prefills the subject with the product name and code for %s', (locale, subject, label) => {
    view(locale, settings, { name: 'Ray Spot', code: 'RS-12' });
    expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(subject);
  });

  it('leaves the subject empty without a product', () => {
    view('en', settings);
    expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe('');
  });

  it('cuts a prefilled subject at the subject limit', () => {
    view('en', settings, { name: 'N'.repeat(300), code: 'C' });
    expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toHaveLength(150);
  });

  it('has no accessibility violations', async () => {
    const { container } = view('tr', settings);
    expect(await axeViolations(container)).toEqual([]);
  });
});
