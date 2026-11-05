import type { EmailMessage } from '../email/index.ts';

// Must match the confirmation link lifetime in the auth options.
export const CHANGE_EMAIL_LIFETIME_SECONDS = 3600;

// Sent to the new address. Turkish first, then English.
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

// Sent to the current address first. Turkish first, then English.
export function changeEmailApprovalEmail(to: string, newEmail: string, link: string): EmailMessage {
  return {
    to,
    subject: 'E-posta değişikliği onayı / Approve the email change',
    text: [
      `Tanyeri yönetim paneli için giriş e-postasının ${newEmail} adresine değiştirilmesi istendi.`,
      'İsteği siz yaptıysanız onaylamak için bağlantıyı açın (bağlantı bir saat geçerlidir).',
      'Ardından yeni adrese ikinci bir bağlantı gönderilir:',
      '',
      link,
      '',
      'Bu isteği siz yapmadıysanız bağlantıyı açmayın; adres değişmez.',
      'Hesabınızın başkasının eline geçtiğini düşünüyorsanız parolanızı değiştirin.',
      '',
      '---',
      '',
      `A change of the sign-in email of the Tanyeri admin panel to ${newEmail} was requested.`,
      'If this was you, open the link to approve it (the link is valid for one hour).',
      'A second link is then sent to the new address:',
      '',
      link,
      '',
      'If you did not make this request, do not open the link; the address will not change.',
      'If you think someone else has access to your account, change your password.',
      '',
    ].join('\n'),
  };
}
