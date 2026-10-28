import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../messages/tr.json' with { type: 'json' };
import HomePage from './page.tsx';

describe('HomePage', () => {
  afterEach(cleanup);

  it.each([
    ['tr', tr, 'Site hazırlanıyor.'],
    ['en', en, 'The site is being prepared.'],
  ])('renders the heading and placeholder sentence for %s', (locale, messages, sentence) => {
    render(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <HomePage />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tanyeri');
    expect(screen.getByText(sentence)).toBeTruthy();
  });
});
