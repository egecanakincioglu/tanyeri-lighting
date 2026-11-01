import { routing } from '../../i18n/routing.ts';
import type { EmailMessage } from '../email/index.ts';

// How long a reset link works. Written out in the auth options too, so the text below stays true.
export const RESET_TOKEN_LIFETIME_SECONDS = 3600;

// The reset page lives in the panel, which has no visitor language yet at this point, so the link uses the
// default locale and the text carries both languages: Turkish first, then English.
export function resetPasswordLink(baseURL: string, token: string): string {
  const link = new URL(`/${routing.defaultLocale}/dashboard/reset-password`, baseURL);
  link.searchParams.set('token', token);
  return link.href;
}

export function resetPasswordEmail(to: string, link: string): EmailMessage {
  return {
    to,
    subject: 'Parola sıfırlama / Password reset',
    text: [
      'Tanyeri yönetim paneli için parola sıfırlama isteği aldık.',
      'Yeni bir parola belirlemek için bağlantıyı açın (bağlantı bir saat geçerlidir):',
      '',
      link,
      '',
      'Bu isteği siz yapmadıysanız bu iletiyi yok sayabilirsiniz; parolanız değişmez.',
      '',
      '---',
      '',
      'We received a request to reset the password for the Tanyeri admin panel.',
      'Open the link to choose a new password (the link is valid for one hour):',
      '',
      link,
      '',
      'If you did not make this request you can ignore this email; your password will not change.',
      '',
    ].join('\n'),
  };
}
