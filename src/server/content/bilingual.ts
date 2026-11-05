import { z } from 'zod';

export interface Bilingual {
  tr: string;
  en: string;
}

type Columns<Key extends string> = Record<`${Key}Tr` | `${Key}En`, string>;

function requiredText(maxLength: number) {
  return z.string().trim().min(1).max(maxLength);
}

export function bilingual(maxLength: number) {
  return z.object({ tr: requiredText(maxLength), en: requiredText(maxLength) });
}

// An optional field is filled in both languages or neither.
// Neither is two empty strings, not NULL, so the columns stay NOT NULL.
export function optionalBilingual(maxLength: number) {
  const text = z.string().trim().max(maxLength);
  return z
    .object({ tr: text, en: text })
    .refine(({ tr, en }) => (tr === '') === (en === ''), 'Fill in both languages or leave both empty');
}

export function toColumns<Key extends string>(key: Key, value: Bilingual): Columns<Key> {
  return { [`${key}Tr`]: value.tr, [`${key}En`]: value.en } as Columns<Key>;
}

export function fromColumns<Key extends string>(key: Key, row: Columns<Key>): Bilingual {
  return { tr: row[`${key}Tr`], en: row[`${key}En`] };
}
