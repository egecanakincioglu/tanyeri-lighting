import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import { AdminShell } from './shell.tsx';

function renderShell(locale: 'tr' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <AdminShell logoLabel="Tanyeri Lighting" backLabel="Back to the site">
        <h1>Title</h1>
      </AdminShell>
    </NextIntlClientProvider>,
  );
}

describe('AdminShell', () => {
  afterEach(cleanup);

  it('shows the logo and a link back to the site, and no site menu', () => {
    const { container } = renderShell('en');
    expect(screen.getByRole('link', { name: 'Tanyeri Lighting' }).getAttribute('href')).toBe('/en');
    expect(screen.getByRole('link', { name: 'Back to the site' }).getAttribute('href')).toBe('/en');
    expect(screen.getByRole('main').textContent).toBe('Title');
    expect(container.querySelector('nav')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('links to the home page of the Turkish site', () => {
    renderShell('tr');
    expect(screen.getByRole('link', { name: 'Back to the site' }).getAttribute('href')).toBe('/tr');
  });

  it('has no axe violations', async () => {
    const { container } = renderShell('en');
    expect(await axeViolations(container)).toEqual([]);
  });
});
