import { cleanup, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../../messages/en.json' with { type: 'json' };
import tr from '../../../messages/tr.json' with { type: 'json' };
import type { SiteSettings, SocialLink } from '../../server/content/schemas.ts';
import { optimizedSource } from '../../test/optimized-source.ts';
import { FooterContent, type LegalLink } from './footer.tsx';

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
  siteName: pair('', ''),
  logoUrl: null,
  phone: '',
  email: '',
  address: pair('', ''),
  workingHours: pair('', ''),
  serviceArea: pair('', ''),
  languages: pair('', ''),
};

const socialLinks: SocialLink[] = [
  { id: 'a', platform: 'instagram', label: pair('Instagram', 'Instagram'), url: 'https://www.example.com/i' },
  { id: 'b', platform: 'unknown-network', label: pair('Başka', 'Other'), url: 'https://www.example.com/o' },
];

const legal: LegalLink[] = [
  { key: 'privacy', title: pair('Gizlilik ve Çerezler', 'Privacy and Cookies') },
  { key: 'terms', title: pair('Şartlar ve Koşullar', 'Terms and Conditions') },
];

function renderFooter(props: Partial<Parameters<typeof FooterContent>[0]> = {}, locale: 'tr' | 'en' = 'tr') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'tr' ? tr : en}>
      <FooterContent settings={settings} socialLinks={socialLinks} legal={legal} year={2031} {...props} />
    </NextIntlClientProvider>,
  );
}

async function violations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((violation) => violation.id);
}

describe('FooterContent', () => {
  afterEach(cleanup);

  it('shows the uploaded logo, and the artwork when there is none', () => {
    const { unmount } = renderFooter({ settings: { ...settings, logoUrl: '/demo/area-otel.webp' } });
    expect(optimizedSource(screen.getByRole('img', { name: 'Tanyeri Lighting' }))).toBe('/demo/area-otel.webp');
    unmount();
    renderFooter({ settings: { ...settings, logoUrl: null } });
    expect(screen.getByRole('img', { name: 'Tanyeri Lighting' }).getAttribute('src')).toBe('/brand/logo.svg');
  });

  it('shows the contact details, social links and legal links in Turkish', () => {
    renderFooter();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('Örnek Mah. Aydınlatma Cad. No: 12')).toBeTruthy();
    expect(within(footer).getByRole('link', { name: '+90 212 000 00 00' }).getAttribute('href')).toBe(
      'tel:+902120000000',
    );
    expect(within(footer).getByRole('link', { name: 'info@tanyeri.example' }).getAttribute('href')).toBe(
      'mailto:info@tanyeri.example',
    );
    expect(within(footer).getByText('Pazartesi - Cuma 09.00 - 18.00')).toBeTruthy();
    expect(within(footer).getByRole('link', { name: 'Instagram' }).getAttribute('href')).toBe(
      'https://www.example.com/i',
    );
    expect(within(footer).getByRole('link', { name: 'Başka' })).toBeTruthy();
    expect(within(footer).getByRole('link', { name: 'Gizlilik ve Çerezler' }).getAttribute('href')).toBe(
      '/tr/gizlilik',
    );
    expect(within(footer).getByRole('link', { name: 'Şartlar ve Koşullar' }).getAttribute('href')).toBe(
      '/tr/kullanim-kosullari',
    );
    expect(within(footer).getByRole('link', { name: 'Yönetici girişi' }).getAttribute('href')).toBe(
      '/tr/yonetim/giris',
    );
    expect(within(footer).getByRole('link', { name: 'Yönetici girişi' }).getAttribute('rel')).toBe('nofollow');
    expect(within(footer).getByText('© 2031 Tanyeri Lighting. Tüm hakları saklıdır.')).toBeTruthy();
    const nav = within(footer).getByRole('navigation', { name: 'Site' });
    expect(within(nav).getByRole('link', { name: 'Kurumsal' }).getAttribute('href')).toBe('/tr/hakkimizda');
    expect(within(nav).getByRole('link', { name: 'Ürünler' }).getAttribute('href')).toBe('/tr/urunler');
    expect(within(nav).getByRole('link', { name: 'Kataloglar' }).getAttribute('href')).toBe('/tr/kataloglar');
    expect(within(nav).getByRole('link', { name: 'Blog' }).getAttribute('href')).toBe('/tr/blog');
  });

  it('uses the English texts and prefixes', () => {
    renderFooter({}, 'en');
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('Example Street 12')).toBeTruthy();
    expect(within(footer).getByRole('link', { name: 'Privacy and Cookies' }).getAttribute('href')).toBe('/en/privacy');
    expect(within(footer).getByRole('link', { name: 'Administrator sign-in' }).getAttribute('href')).toBe(
      '/en/admin/sign-in',
    );
    expect(within(footer).getByText('© 2031 Tanyeri Lighting. All rights reserved.')).toBeTruthy();
    expect(within(footer).getByRole('link', { name: 'Catalogs' }).getAttribute('href')).toBe('/en/catalogs');
  });

  it('renders cleanly without any content', () => {
    const { container } = renderFooter({ settings: emptySettings, socialLinks: [], legal: [] });
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).queryByText('Adres')).toBeNull();
    expect(within(footer).queryByRole('heading', { name: 'İletişim' })).toBeNull();
    expect(footer.querySelector('address')).toBeNull();
    expect(footer.querySelectorAll('ul').length).toBe(2);
    expect(within(footer).getByRole('link', { name: 'Yönetici girişi' })).toBeTruthy();
    expect(within(footer).getByText('© 2031 Tanyeri. Tüm hakları saklıdır.')).toBeTruthy();
    expect(within(footer).getByRole('img', { name: 'Tanyeri Lighting' })).toBeTruthy();
    expect(container.querySelectorAll('a[href=""]').length).toBe(0);
  });

  it('leaves out only the rows that are empty', () => {
    renderFooter({ settings: { ...emptySettings, email: 'info@tanyeri.example' } });
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('E-posta')).toBeTruthy();
    expect(within(footer).queryByText('Telefon')).toBeNull();
    expect(within(footer).queryByText('Adres')).toBeNull();
  });

  it('shows the developer credit at exactly twice its shown size', () => {
    renderFooter();
    const img = screen.getByRole('img', { name: 'Flareye' });
    expect(img.getAttribute('src')).toBe('/brand/flareye.webp');
    expect(img.getAttribute('width')).toBe('96');
    expect(img.getAttribute('height')).toBe('24');
    expect(img.getAttribute('loading')).toBe('lazy');
    const webp = readFileSync(join(import.meta.dirname, '..', '..', '..', 'public', 'brand', 'flareye.webp'));
    // An extended WebP header stores width and height minus one as 24-bit little-endian numbers.
    expect(webp.subarray(12, 16).toString()).toBe('VP8X');
    expect(webp.readUIntLE(24, 3) + 1).toBe(192);
    expect(webp.readUIntLE(27, 3) + 1).toBe(48);
  });

  it('has no axe violations with and without content', async () => {
    const full = renderFooter();
    expect(await violations(full.container)).toEqual([]);
    cleanup();
    const empty = renderFooter({ settings: emptySettings, socialLinks: [], legal: [] }, 'en');
    expect(await violations(empty.container)).toEqual([]);
  });
});
