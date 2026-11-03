import type { ErrorCode, FieldError } from '../../server/admin/form.ts';

// The texts the panel's client components share. Server pages build them from messages/*.json (the AdminForm
// namespace) and pass them down, because the browser never receives the message files.

type Translate = (key: string, values?: Record<string, string | number>) => string;

const ERROR_CODES: readonly ErrorCode[] = [
  'invalid',
  'demo',
  'unauthorized',
  'notFound',
  'invalidOrder',
  'taken',
  'categoryLimit',
  'categoryNotEmpty',
  'catalogInUse',
  'storageOff',
  'tooLarge',
  'unsupportedType',
  'unreadableImage',
  'generic',
];

export type FormTexts = {
  save: string;
  saving: string;
  saved: string;
  /** Why save, delete, reorder and upload are off in the demo. */
  demoNote: string;
  languages: { tr: string; en: string };
  errors: Record<ErrorCode, string>;
  /** The optional description of a picture, shared by every form that has one. */
  imageAlt: { label: string; hint: string; both: string };
  fieldErrors: { required: string; /** Holds `{max}`. */ tooLong: string; invalid: string; taken: string };
};

export function buildFormTexts(t: Translate): FormTexts {
  return {
    save: t('save'),
    saving: t('saving'),
    saved: t('saved'),
    demoNote: t('demoNote'),
    languages: { tr: t('languageTr'), en: t('languageEn') },
    errors: Object.fromEntries(ERROR_CODES.map((code) => [code, t(`errors.${code}`)])) as Record<ErrorCode, string>,
    imageAlt: { label: t('imageAlt.label'), hint: t('imageAlt.hint'), both: t('imageAlt.both') },
    fieldErrors: {
      required: t('fieldErrors.required'),
      // The placeholder is its own value: the browser fills in the limit of the field that failed.
      tooLong: t('fieldErrors.tooLong', { max: '{max}' }),
      invalid: t('fieldErrors.invalid'),
      taken: t('fieldErrors.taken'),
    },
  };
}

export function fieldMessage(texts: FormTexts, error: FieldError | undefined): string | undefined {
  if (!error) return undefined;
  return error.code === 'tooLong'
    ? texts.fieldErrors.tooLong.replace('{max}', String(error.max ?? 0))
    : texts.fieldErrors[error.code];
}
