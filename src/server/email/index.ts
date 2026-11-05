import { after } from 'next/server';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getSmtpConfig } from '../env.ts';
import type { SmtpConfig } from '../env.ts';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

// Thrown instead of sending quietly, so a caller that skipped isEmailEnabled() finds out.
export class EmailDisabledError extends Error {
  constructor() {
    super('Email is off: the SMTP variables are not set');
    this.name = 'EmailDisabledError';
  }
}

let transport: Transporter | undefined;

// Created on first use, not on import, so `next build` works without the variables.
function getTransport(config: SmtpConfig): Transporter {
  transport ??= createTransport({
    host: config.host,
    port: config.port,
    // Port 465 is TLS from the first byte; other ports upgrade with STARTTLS when the server offers it.
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
  });
  return transport;
}

// Test hook: swap in a nodemailer built-in transport; undefined resets.
export function setEmailTransport(replacement: Transporter | undefined): void {
  transport = replacement;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const config = getSmtpConfig();
  if (!config) throw new EmailDisabledError();
  await getTransport(config).sendMail({ from: config.from, ...message });
}

type Scheduler = (task: () => Promise<void>) => void;

// `after` needs a request scope, so tests swap in a scheduler; undefined resets.
let schedule: Scheduler = after;

export function setEmailScheduler(replacement: Scheduler | undefined): void {
  schedule = replacement ?? after;
}

// Sent after the response, so timing is the same whether a mail is sent or not,
// and a mail failure never reaches the visitor.
// The log holds the error kind only: messages can contain the address.
// `allowed` also runs after the response and may veto the mail.
export function sendEmailAfterResponse(message: EmailMessage, allowed?: () => Promise<boolean>): void {
  schedule(async () => {
    try {
      if (allowed && !(await allowed())) return;
      await sendEmail(message);
    } catch (error) {
      const { name, code } = error as { name?: unknown; code?: unknown };
      console.error('Sending an email failed', { name, code });
    }
  });
}
