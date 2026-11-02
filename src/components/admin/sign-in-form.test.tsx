import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SignInState } from '../../server/auth/sign-in-action.ts';
import { axeViolations } from '../../test/axe.ts';
import { SignInForm, type SignInFormTexts } from './sign-in-form.tsx';

const texts: SignInFormTexts = {
  email: 'E-mail',
  passLabel: 'Password',
  submit: 'Sign in',
  submitting: 'Signing in',
  error: 'Wrong e-mail or password.',
  rateLimited: 'Too many attempts.',
};

function setup(result: SignInState = { status: 'error', email: 'admin@example.com' }) {
  const action = vi.fn(async () => result);
  const view = render(<SignInForm action={action} locale="en" texts={texts} />);
  return { action, ...view };
}

async function submit() {
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
  });
}

describe('SignInForm', () => {
  afterEach(cleanup);

  it('has labelled fields with the types and autocomplete values password managers need', () => {
    setup();
    const email = screen.getByLabelText('E-mail') as HTMLInputElement;
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(email.type).toBe('email');
    expect(email.autocomplete).toBe('username');
    expect(email.required).toBe(true);
    expect(password.type).toBe('password');
    expect(password.autocomplete).toBe('current-password');
    expect(password.required).toBe(true);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('does not block pasting', () => {
    setup();
    for (const label of ['E-mail', 'Password']) {
      const field = screen.getByLabelText(label);
      expect(field.hasAttribute('onpaste')).toBe(false);
      expect(fireEvent.paste(field)).toBe(true);
    }
  });

  it('names the language in a hidden field and starts without an error', () => {
    const { container } = setup();
    expect((container.querySelector('input[name="locale"]') as HTMLInputElement).value).toBe('en');
    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('shows the generic error in the announced region and ties both fields to it', async () => {
    setup();
    await submit();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Wrong e-mail or password.');
    for (const label of ['E-mail', 'Password']) {
      expect(screen.getByLabelText(label).getAttribute('aria-describedby')).toBe(alert.id);
    }
  });

  it('keeps the typed address after a refused attempt', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'admin@example.com' } });
    await submit();
    expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('admin@example.com');
  });

  it('says so when the attempts are limited', async () => {
    setup({ status: 'rate-limited', email: 'a@example.com' });
    await submit();
    expect(screen.getByRole('alert').textContent).toBe('Too many attempts.');
  });

  it('has no axe violations, with and without an error', async () => {
    const { container } = setup();
    expect(await axeViolations(container)).toEqual([]);
    await submit();
    expect(await axeViolations(container)).toEqual([]);
  });
});
