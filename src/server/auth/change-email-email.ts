import type { EmailMessage } from '../email/index.ts';

// How long the confirmation link works. Written out in the auth options too, so the text below stays true.
export const CHANGE_EMAIL_LIFETIME_SECONDS = 3600;

// Sent to the new address, which the link proves belongs to the admin. Turkish first, then English.
export function changeEmailEmail(to: string, link: string): EmailMessage {
  return {
    to,
    subject: 'E-posta adresi onayı / Confirm your email address',
    text: [
      'Tanyeri yönetim paneli için bu adresi giriş e-postası olarak ayarlama isteği aldık.',
      'Değişikliği onaylamak için bağlantıyı açın (bağlantı bir saat geçerlidir):',
      '',
      link,
      '',
      'Bu isteği siz yapmadıysanız bu iletiyi yok sayabilirsiniz; adres değişmez.',
      '',
      '---',
      '',
      'We received a request to use this address as the sign-in email for the Tanyeri admin panel.',
      'Open the link to confirm the change (the link is valid for one hour):',
      '',
      link,
      '',
      'If you did not make this request you can ignore this email; the address will not change.',
      '',
    ].join('\n'),
  };
}
