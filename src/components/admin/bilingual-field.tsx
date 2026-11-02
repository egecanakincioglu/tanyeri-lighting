import { TextAreaField, TextField } from '../field.tsx';

type Props = {
  /** The base name: the inputs are `<name>.tr` and `<name>.en`, the keys the Server Actions read. */
  name: string;
  label: string;
  languages: { tr: string; en: string };
  defaultValue?: { tr: string; en: string };
  multiline?: boolean;
  /** The field may be left empty in both languages. */
  optional?: boolean;
  /** The limit of the schema, applied to both inputs. */
  maxLength?: number;
  /** Already translated, one per language. */
  errors?: { tr?: string | undefined; en?: string | undefined };
};

/** Turkish and English side by side on wide screens, stacked on phones. Both are required by the schemas. */
export function BilingualField({
  name,
  label,
  languages,
  defaultValue,
  multiline,
  optional,
  maxLength,
  errors,
}: Props) {
  const Field = multiline ? TextAreaField : TextField;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-base font-bold">{label}</legend>
      <div className="grid gap-4 md:grid-cols-2">
        {(['tr', 'en'] as const).map((language) => (
          <Field
            key={language}
            id={`${name}-${language}`}
            name={`${name}.${language}`}
            label={languages[language]}
            lang={language}
            defaultValue={defaultValue?.[language] ?? ''}
            maxLength={maxLength}
            required={!optional}
            error={errors?.[language]}
          />
        ))}
      </div>
    </fieldset>
  );
}
