import type { FieldError } from '../../server/admin/form.ts';
import { BilingualField } from './bilingual-field.tsx';
import { fieldMessage, type FormTexts } from './texts.ts';

// Keep in sync with imageAlt in src/server/content/schemas.ts.
const IMAGE_ALT_LIMIT = 200;

type Props = {
  texts: FormTexts;
  defaultValue?: { tr: string; en: string } | undefined;
  errors: Record<string, FieldError | undefined>;
};

/** Both languages or neither; the schema reports a half-filled pair on `imageAlt`. */
export function ImageAltField({ texts, defaultValue, errors }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <BilingualField
        name="imageAlt"
        label={texts.imageAlt.label}
        languages={texts.languages}
        defaultValue={defaultValue}
        maxLength={IMAGE_ALT_LIMIT}
        optional
        errors={{
          tr: fieldMessage(texts, errors['imageAlt.tr']),
          en: fieldMessage(texts, errors['imageAlt.en']),
        }}
        error={errors['imageAlt'] ? texts.imageAlt.both : undefined}
      />
      <p className="text-sm text-muted">{texts.imageAlt.hint}</p>
    </div>
  );
}
