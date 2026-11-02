import en from '../../messages/en.json' with { type: 'json' };
import tr from '../../messages/tr.json' with { type: 'json' };

type Messages = Record<string, unknown>;
const MESSAGES: Record<string, Messages> = { tr, en };

function lookup(root: unknown, path: string): string {
  let node = root;
  for (const part of path.split('.')) node = (node as Messages | undefined)?.[part];
  return typeof node === 'string' ? node : '';
}

/**
 * A stand-in for getTranslations of next-intl/server, which needs the Next.js server runtime. It reads the real
 * message files, supports dotted keys and fills `{name}` values, so a page test sees the texts a visitor sees.
 */
export function getTranslations({ locale, namespace }: { locale: string; namespace: string }) {
  const messages = MESSAGES[locale]?.[namespace];
  return Promise.resolve((key: string, values: Record<string, string | number> = {}) => {
    const message = lookup(messages, key);
    // next-intl reports a FORMATTING_ERROR for a placeholder without a value; failing here keeps that visible.
    for (const [, name] of message.matchAll(/\{(\w+)\}/g)) {
      if (!(name! in values)) throw new Error(`"${name}" was not provided for ${namespace}.${key}`);
    }
    return Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), message);
  });
}
