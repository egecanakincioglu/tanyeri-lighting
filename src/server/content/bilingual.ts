import { z } from 'zod';

// Bilingual content is two required columns per field, `<field>Tr` and `<field>En` (ADR 0006). Services take and
// return a { tr, en } pair; these helpers are the whole mapping between the pair and the columns.

export interface Bilingual {
  tr: string;
  en: string;
}

type Columns<Key extends string> = Record<`${Key}Tr` | `${Key}En`, string>;

function requiredText(maxLength: number) {
  return z.string().trim().min(1).max(maxLength);
}

// Both languages are required and trimmed: there is no fallback from one language to the other.
export function bilingual(maxLength: number) {
  return z.object({ tr: requiredText(maxLength), en: requiredText(maxLength) });
}

// An optional field is filled in both languages or in neither, never in one. "Neither" is a pair of empty strings, not
// NULL: the columns stay NOT NULL like every other bilingual column and the field keeps its { tr, en } shape, so
// toColumns and fromColumns work unchanged and there is one way to say "none".
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
