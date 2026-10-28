import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../../messages/en.json' with { type: 'json' };
import tr from '../../../messages/tr.json' with { type: 'json' };
import NotFound from './not-found.tsx';

describe('NotFound', () => {
  afterEach(cleanup);

  it.each([
    ['tr', tr, 'Sayfa bulunamadı'],
    ['en', en, 'Page not found'],
  ])('renders the single heading for %s', (locale, messages, title) => {
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <NotFound />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title);
  });
});
