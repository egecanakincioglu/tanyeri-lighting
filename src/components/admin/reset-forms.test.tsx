import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import {
  RequestResetForm,
  ResetPasswordForm,
  type RequestResetTexts,
  type ResetPasswordTexts,
} from './reset-forms.tsx';

const errors = { rateLimited: 'Too many attempts.', demo: 'Not in the demo.', generic: 'Something went wrong.' };

const requestTexts: RequestResetTexts = {
  intro: 'Enter your address.',
  email: 'E-mail',
  submit: 'Send the link',
  submitting: 'Sending',
  done: 'If the address is known, a link was sent.',
  signIn: 'Go to sign-in',
  errors,
};

const resetTexts: ResetPasswordTexts = {
  intro: 'Choose a new password.',
  next: 'New password',
  repeat: 'Repeat the password',
  hint: 'Use 8 to 128 characters.',
  submit: 'Change the password',
  submitting: 'Changing',
  done: 'The password was changed.',
  signIn: 'Go to sign-in',
  invalidTitle: 'This link does not work',
  invalidText: 'The link expired or was used.',
  requestAgain: 'Request a new link',
  errors,
  issues: { tooShort: 'Too short.', tooLong: 'Too long.', mismatch: 'Not the same.' },
};

function inTr(node: ReactNode) {
  return (
    <NextIntlClientProvider locale="tr" messages={{}}>
      {node}
    </NextIntlClientProvider>
  );
}

function answer(status: number, body: object = {}) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RequestResetForm', () => {
  it('has one labelled e-mail field and a way back to sign-in', async () => {
    const { container } = render(inTr(<RequestResetForm texts={requestTexts} />));
    const email = screen.getByLabelText('E-mail') as HTMLInputElement;
    expect(email.type).toBe('email');
    expect(email.required).toBe(true);
    expect(screen.getByRole('link', { name: 'Go to sign-in' }).getAttribute('href')).toBe('/tr/yonetim/giris');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('posts the trimmed address to the auth endpoint and shows the same answer', async () => {
    const fetchMock = answer(200);
    render(inTr(<RequestResetForm texts={requestTexts} />));
    type('E-mail', ' admin@example.com ');
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    await screen.findByText(requestTexts.done);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/request-password-reset');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'admin@example.com' });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disables the button while the request runs', async () => {
    let finish: (response: Response) => void = () => {};
    vi.stubGlobal('fetch', () => new Promise<Response>((resolve) => (finish = resolve)));
    render(inTr(<RequestResetForm texts={requestTexts} />));
    type('E-mail', 'admin@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    const busy = (await screen.findByRole('button', { name: 'Sending' })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    finish(new Response('{}', { status: 200 }));
    await screen.findByText(requestTexts.done);
  });

  it.each([
    [429, errors.rateLimited],
    [403, errors.demo],
    [500, errors.generic],
  ])('shows the message for status %i and keeps the address', async (status, message) => {
    answer(status);
    render(inTr(<RequestResetForm texts={requestTexts} />));
    type('E-mail', 'admin@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('admin@example.com');
  });

  it('shows the plain failure when the network is down', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    render(inTr(<RequestResetForm texts={requestTexts} />));
    type('E-mail', 'admin@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    expect((await screen.findByRole('alert')).textContent).toBe(errors.generic);
  });
});

describe('ResetPasswordForm', () => {
  function setup(resetKey = 'abc') {
    return render(inTr(<ResetPasswordForm resetKey={resetKey} texts={resetTexts} />));
  }
  function submit(next: string, repeat: string) {
    type('New password', next);
    type('Repeat the password', repeat);
    fireEvent.click(screen.getByRole('button', { name: 'Change the password' }));
  }

  it('has two labelled new-password fields', async () => {
    const { container } = setup();
    for (const label of ['New password', 'Repeat the password']) {
      const field = screen.getByLabelText(label) as HTMLInputElement;
      expect(field.type).toBe('password');
      expect(field.autocomplete).toBe('new-password');
    }
    expect(await axeViolations(container)).toEqual([]);
  });

  it('posts the new password with the key and then links to sign-in', async () => {
    const fetchMock = answer(200);
    setup('abc');
    submit('a long enough passphrase', 'a long enough passphrase');
    await screen.findByText(resetTexts.done);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/reset-password');
    expect(JSON.parse(String(init.body))).toEqual({ newPassword: 'a long enough passphrase', token: 'abc' });
    expect(screen.getByRole('link', { name: 'Go to sign-in' }).getAttribute('href')).toBe('/tr/yonetim/giris');
  });

  it.each([
    ['short', 'short', 'New password', 'Too short.'],
    ['x'.repeat(129), 'x'.repeat(129), 'New password', 'Too long.'],
    ['a long enough passphrase', 'another long passphrase', 'Repeat the password', 'Not the same.'],
  ])('checks the passwords before sending (%#)', (next, repeat, label, message) => {
    const fetchMock = answer(200);
    setup();
    submit(next, repeat);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBe('true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the dead end with a link back for an expired or used link', async () => {
    answer(400, { code: 'INVALID_TOKEN' });
    setup();
    submit('a long enough passphrase', 'a long enough passphrase');
    await screen.findByRole('heading', { name: 'This link does not work' });
    expect(screen.queryByLabelText('New password')).toBeNull();
    expect(screen.getByRole('link', { name: 'Request a new link' }).getAttribute('href')).toBe(
      '/tr/yonetim/parola-unuttum',
    );
  });

  it('shows the dead end at once when the link has no key', async () => {
    const fetchMock = answer(200);
    const { container } = setup('');
    expect(screen.getByRole('heading', { name: 'This link does not work' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await axeViolations(container)).toEqual([]);
  });

  it.each([
    [429, errors.rateLimited],
    [403, errors.demo],
    [400, errors.generic],
    [500, errors.generic],
  ])('shows the message for status %i and keeps the form', async (status, message) => {
    answer(status, status === 400 ? { code: 'PASSWORD_TOO_SHORT' } : {});
    setup();
    submit('a long enough passphrase', 'a long enough passphrase');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(message));
    expect(screen.getByLabelText('New password')).toBeTruthy();
  });
});
