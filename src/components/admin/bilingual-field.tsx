import { TextAreaField, TextField } from '../field.tsx';

type Props = {
  /** Inputs are `<name>.tr` and `<name>.en`; the Server Actions read these keys. */
  name: string;
  label: string;
  languages: { tr: string; en: string };
  defaultValue?: { tr: string; en: string };
  multiline?: boolean;
  optional?: boolean;
  maxLength?: number;
  /** Replaces the base name in input ids when a field appears more than once on a page. */
  idPrefix?: string;
  errors?: { tr?: string | undefined; en?: string | undefined };
  error?: string | undefined;
};

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
    <fieldset
      className="min-w-0 rounded-md border border-hairline px-4 pt-1 pb-5 sm:px-5"
      aria-describedby={error ? `${idPrefix}-error` : undefined}
    >
      <legend className="px-2 text-base font-bold">{label}</legend>
      <div className="mt-2 grid gap-4 md:grid-cols-2">
        {(['tr', 'en'] as const).map((language) => (
          <div key={language} className="min-w-0">
            <Field
              id={`${idPrefix}-${language}`}
              name={`${name}.${language}`}
              label={languages[language]}
              lang={language}
              defaultValue={defaultValue?.[language] ?? ''}
              maxLength={maxLength}
              required={!optional}
              error={errors?.[language]}
            />
          </div>
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
