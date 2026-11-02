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
  /** Replaces the base name in the input ids when the same field appears more than once on a page. */
  idPrefix?: string;
  /** Already translated, one per language. */
  errors?: { tr?: string | undefined; en?: string | undefined };
  /** Already translated message about the pair as a whole, shown under both inputs. */
  error?: string | undefined;
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
  idPrefix = name,
  errors,
  error,
}: Props) {
  const Field = multiline ? TextAreaField : TextField;
  return (
    <fieldset className="min-w-0" aria-describedby={error ? `${idPrefix}-error` : undefined}>
      <legend className="mb-2 text-base font-bold">{label}</legend>
      <div className="grid gap-4 md:grid-cols-2">
        {(['tr', 'en'] as const).map((language) => (
          <Field
            key={language}
            id={`${idPrefix}-${language}`}
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
      {error && (
        <p id={`${idPrefix}-error`} role="alert" className="mt-2 text-sm font-medium text-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
