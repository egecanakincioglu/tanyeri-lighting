import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axeViolations } from '../test/axe.ts';
import { TextAreaField, TextField } from './field.tsx';

describe('TextField', () => {
  afterEach(cleanup);

  it('labels the input and passes native attributes through', () => {
    render(<TextField id="email" label="Email" name="email" type="email" autoComplete="email" required />);
    const input = screen.getByLabelText('Email') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('email');
    expect(input.getAttribute('autocomplete')).toBe('email');
    expect(input.getAttribute('name')).toBe('email');
    expect(input.required).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('ties the error text to the input', () => {
    render(<TextField id="email" label="Email" error="Enter a valid email address." />);
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('email-error');
    expect(document.getElementById('email-error')?.textContent).toBe('Enter a valid email address.');
    expect(screen.getByRole('textbox', { description: 'Enter a valid email address.' })).toBe(input);
  });

  it('has no accessibility violations, with or without an error', async () => {
    const { container, rerender } = render(<TextField id="n" label="Name" />);
    expect(await axeViolations(container)).toEqual([]);
    rerender(<TextField id="n" label="Name" error="Required." />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('TextAreaField', () => {
  afterEach(cleanup);

  it('labels the textarea and ties the error to it', () => {
    render(<TextAreaField id="message" label="Message" name="message" error="Too long." />);
    const area = screen.getByLabelText('Message');
    expect(area.tagName).toBe('TEXTAREA');
    expect(area.getAttribute('aria-invalid')).toBe('true');
    expect(area.getAttribute('aria-describedby')).toBe('message-error');
  });

  it('has no error wiring without an error', () => {
    render(<TextAreaField id="message" label="Message" />);
    expect(screen.getByLabelText('Message').getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByText('Too long.')).toBeNull();
  });
});
