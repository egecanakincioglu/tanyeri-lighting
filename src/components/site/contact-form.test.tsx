import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import type { ContactState } from '../../server/contact/form.ts';
import { ContactForm, type ContactFormTexts } from './contact-form.tsx';

const texts: ContactFormTexts = {
  name: 'Your name',
  email: 'Your email',
  subject: 'Subject',
  message: 'Your message',
  send: 'Send message',
  sending: 'Sending',
  errors: { required: 'Required.', too_long: 'Too long.', invalid: 'Invalid.' },
  invalidSummary: 'Not sent. Check the fields.',
  rateLimited: 'Too many messages. Try again in {minutes} minutes.',
  okTitle: 'Message sent',
  okText: 'Thank you.',
  demoTitle: 'Demo: not saved',
  demoNote: 'This is a demo, so nothing was saved.',
};

const values = { name: '', email: '', subject: '', message: '' };
const limits = { name: 100, email: 254, subject: 150, message: 5000 };

function setup(result: ContactState | null = null, initialValues?: { subject?: string }) {
  const action = vi.fn(async () => result as ContactState);
  const view = render(
    <ContactForm
      action={action}
      locale="en"
      honeypotName="website"
      limits={limits}
      texts={texts}
      initialValues={initialValues}
    />,
  );
  return { action, ...view };
}

async function submit() {
  await act(async () => {
    fireEvent.submit(screen.getByRole('button', { name: 'Send message' }).closest('form')!);
  });
}

describe('ContactForm', () => {
  afterEach(cleanup);

  it('renders a labelled field for every input with the right types and autocomplete values', () => {
    setup();
    const name = screen.getByLabelText('Your name');
    const email = screen.getByLabelText('Your email');
    expect(name.getAttribute('autocomplete')).toBe('name');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(email.getAttribute('type')).toBe('email');
    expect(screen.getByLabelText('Subject').getAttribute('type')).toBe('text');
    expect(screen.getByLabelText('Your message').tagName).toBe('TEXTAREA');
    for (const label of ['Your name', 'Your email', 'Subject', 'Your message']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).required).toBe(true);
    }
    expect(screen.getByLabelText('Your message').getAttribute('maxlength')).toBe('5000');
  });

  it('names the form as a tool for in-page tool support', () => {
    const { container } = setup();
    const form = container.querySelector('form')!;
    expect(form.getAttribute('toolname')).toBe('send_contact_message');
    expect(form.getAttribute('tooldescription')).toContain('contact form');
  });

  it('fills the subject from the initial values and leaves the other fields empty', () => {
    setup(null, { subject: 'Product enquiry: Ray Spot (RS-12)' });
    expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe('Product enquiry: Ray Spot (RS-12)');
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Your message') as HTMLTextAreaElement).value).toBe('');
  });

  it('sends the visitor language and a hidden honeypot that people cannot reach', () => {
    const { container } = setup();
    expect(container.querySelector<HTMLInputElement>('input[name="locale"]')?.value).toBe('en');
    const trap = container.querySelector<HTMLInputElement>('input[name="website"]');
    expect(trap?.tabIndex).toBe(-1);
    expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('posts the typed values to the action', async () => {
    const { action } = setup({ status: 'ok' });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ayse' } });
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'ayse@example.com' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Quote' } });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });
    await submit();
    const sent = (action.mock.calls[0] as unknown as [ContactState | null, FormData])[1];
    expect(Object.fromEntries(sent)).toMatchObject({
      name: 'Ayse',
      email: 'ayse@example.com',
      subject: 'Quote',
      message: 'Hello',
      locale: 'en',
    });
  });

  it('shows each field error next to its field and announces a summary', async () => {
    setup({ status: 'invalid', fieldErrors: { email: 'invalid', subject: 'required', message: 'too_long' }, values });
    await submit();
    const email = screen.getByLabelText('Your email');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Your email', description: 'Invalid.' })).toBe(email);
    expect(screen.getByRole('textbox', { name: 'Subject', description: 'Required.' })).toBeTruthy();
    expect(screen.getByLabelText('Your message').getAttribute('aria-describedby')).toBe('contact-message-error');
    expect(screen.getByLabelText('Your name').getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Not sent. Check the fields.');
  });

  it('keeps what the visitor typed after a refused submission', async () => {
    setup({ status: 'invalid', fieldErrors: { email: 'invalid' }, values });
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'nope' } });
    await submit();
    expect((screen.getByLabelText('Your email') as HTMLInputElement).value).toBe('nope');
  });

  it('announces the wait time when rate limited, rounded up to whole minutes', async () => {
    setup({ status: 'rate-limited', retryAfterSeconds: 61, values });
    await submit();
    expect(screen.getByRole('status').textContent).toBe('Too many messages. Try again in 2 minutes.');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeTruthy();
  });

  it('replaces the form with a confirmation after a stored message', async () => {
    setup({ status: 'ok' });
    await submit();
    expect(screen.getByRole('status').textContent).toContain('Message sent');
    expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull();
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('shows the message back in place of the form in demo mode, with the note', async () => {
    setup({
      status: 'demo',
      summary: { name: 'Ayse', email: 'ayse@example.com', subject: 'Quote', message: 'Line one\nLine two' },
    });
    await submit();
    const region = screen.getByRole('status');
    expect(region.textContent).toContain('Demo: not saved');
    expect(region.textContent).toContain('This is a demo, so nothing was saved.');
    for (const value of ['Ayse', 'ayse@example.com', 'Quote']) expect(region.textContent).toContain(value);
    expect(screen.getByText('Line one Line two', { normalizer: (s) => s.replace(/\s+/g, ' ') })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull();
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });

  it('keeps the status region in the page before any submission', () => {
    setup();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('has no accessibility violations in the form, with errors and in the demo view', async () => {
    const { container } = setup();
    expect(await axeViolations(container)).toEqual([]);
    cleanup();
    const invalid = setup({ status: 'invalid', fieldErrors: { name: 'required', email: 'invalid' }, values });
    await submit();
    expect(await axeViolations(invalid.container)).toEqual([]);
    cleanup();
    const demo = setup({ status: 'demo', summary: { name: 'A', email: 'a@example.com', subject: 'S', message: 'M' } });
    await submit();
    expect(await axeViolations(demo.container)).toEqual([]);
  });
});
