'use client';

import { useState, type FormEvent } from 'react';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../../lib/password-rules.ts';
import { Link } from '../../i18n/navigation.ts';
import { Button } from '../button.tsx';
import { TextField } from '../field.tsx';

// Checked here for instant feedback; the auth layer enforces the same limits.

const linkClass = 'inline-flex min-h-touch items-center font-medium text-ink underline underline-offset-4';

type Failure = 'rateLimited' | 'demo' | 'generic';

// Posts straight to the auth endpoints: only requests that reach the handler are rate limited.
async function post(path: string, body: object): Promise<{ status: number; code: string }> {
  try {
    const response = await fetch(`/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    const code =
      typeof data === 'object' && data !== null && 'code' in data && typeof data.code === 'string' ? data.code : '';
    return { status: response.status, code };
  } catch {
    return { status: 0, code: '' };
  }
}

function failureOf(status: number): Failure {
  if (status === 429) return 'rateLimited';
  if (status === 403) return 'demo';
  return 'generic';
}

export type RequestResetTexts = {
  intro: string;
  email: string;
  submit: string;
  submitting: string;
  done: string;
  signIn: string;
  errors: Record<Failure, string>;
};

export function RequestResetForm({ texts }: { texts: RequestResetTexts }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | Failure>('idle');
  const [email, setEmail] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('working');
    const { status } = await post('/request-password-reset', { email: email.trim() });
    // Same answer for a known and an unknown address, so a refused address looks accepted.
    setState(status === 200 ? 'done' : failureOf(status));
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="leading-6">
          {texts.done}
        </p>
        <Link href="/dashboard/sign-in" prefetch={false} className={linkClass}>
          {texts.signIn}
        </Link>
      </div>
    );
  }

  const failure = state === 'idle' || state === 'working' ? undefined : state;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <p className="leading-6">{texts.intro}</p>
      <div role="alert">{failure && <p className="font-medium text-error">{texts.errors[failure]}</p>}</div>
      <TextField
        id="email"
        name="email"
        type="email"
        label={texts.email}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button type="submit" disabled={state === 'working'}>
        {state === 'working' ? texts.submitting : texts.submit}
      </Button>
      <Link href="/dashboard/sign-in" prefetch={false} className={`${linkClass} self-start`}>
        {texts.signIn}
      </Link>
    </form>
  );
}

export type ResetPasswordTexts = {
  intro: string;
  next: string;
  repeat: string;
  hint: string;
  submit: string;
  submitting: string;
  done: string;
  signIn: string;
  invalidTitle: string;
  invalidText: string;
  requestAgain: string;
  errors: Record<Failure, string>;
  issues: Record<'tooShort' | 'tooLong' | 'mismatch', string>;
};

type ResetState = 'idle' | 'working' | 'done' | 'invalid' | Failure;

export function ResetPasswordForm({ resetKey, texts }: { resetKey: string; texts: ResetPasswordTexts }) {
  // An empty key means the link had none, a dead end like an expired link.
  const [state, setState] = useState<ResetState>(resetKey === '' ? 'invalid' : 'idle');
  const [issue, setIssue] = useState<{ field: 'next' | 'repeat'; kind: keyof ResetPasswordTexts['issues'] }>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = String(data.get('next') ?? '');
    const repeat = String(data.get('repeat') ?? '');
    if (next.length < MIN_PASSWORD_LENGTH) return setIssue({ field: 'next', kind: 'tooShort' });
    if (next.length > MAX_PASSWORD_LENGTH) return setIssue({ field: 'next', kind: 'tooLong' });
    if (next !== repeat) return setIssue({ field: 'repeat', kind: 'mismatch' });

    setIssue(undefined);
    setState('working');
    const { status, code } = await post('/reset-password', { newPassword: next, token: resetKey });
    if (status === 200) return setState('done');
    setState(code === 'INVALID_TOKEN' ? 'invalid' : failureOf(status));
  }

  if (state === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="leading-6">
          {texts.done}
        </p>
        <Link href="/dashboard/sign-in" prefetch={false} className={linkClass}>
          {texts.signIn}
        </Link>
      </div>
    );
  }

  if (state === 'invalid') {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{texts.invalidTitle}</h2>
        <p className="leading-6">{texts.invalidText}</p>
        <Link href="/dashboard/forgot-password" prefetch={false} className={linkClass}>
          {texts.requestAgain}
        </Link>
      </div>
    );
  }

  const failure = state === 'idle' || state === 'working' ? undefined : state;
  const issueFor = (field: 'next' | 'repeat') => (issue?.field === field ? texts.issues[issue.kind] : undefined);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <p className="leading-6">{texts.intro}</p>
      <div role="alert">{failure && <p className="font-medium text-error">{texts.errors[failure]}</p>}</div>
      <div className="flex flex-col gap-1.5">
        <TextField
          id="next"
          name="next"
          type="password"
          label={texts.next}
          autoComplete="new-password"
          required
          error={issueFor('next')}
        />
        <p className="text-sm text-muted">{texts.hint}</p>
      </div>
      <TextField
        id="repeat"
        name="repeat"
        type="password"
        label={texts.repeat}
        autoComplete="new-password"
        required
        error={issueFor('repeat')}
      />
      <Button type="submit" disabled={state === 'working'}>
        {state === 'working' ? texts.submitting : texts.submit}
      </Button>
    </form>
  );
}
