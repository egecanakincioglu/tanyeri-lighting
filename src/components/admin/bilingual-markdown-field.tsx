import { MarkdownField } from './markdown-field.tsx';

type Props = {
  /** Inputs are `<name>.tr` and `<name>.en`; the Server Actions read these keys. */
  name: string;
  label: string;
  languages: { tr: string; en: string };
  defaultValue?: { tr: string; en: string };
  maxLength?: number;
  errors?: { tr?: string | undefined; en?: string | undefined };
  texts: { hint: string; edit: string; preview: string; loading: string };
};

export function BilingualMarkdownField({ name, label, languages, defaultValue, maxLength, errors, texts }: Props) {
  return (
    <fieldset className="min-w-0 rounded-md border border-hairline px-4 pt-1 pb-5 sm:px-5">
      <legend className="px-2 text-base font-bold">{label}</legend>
      <div className="mt-2 grid gap-6 lg:grid-cols-2">
        {(['tr', 'en'] as const).map((language) => (
          <div key={language} className="min-w-0">
            <MarkdownField
              id={`${name}-${language}`}
              name={`${name}.${language}`}
              label={languages[language]}
              lang={language}
              defaultValue={defaultValue?.[language] ?? ''}
              maxLength={maxLength}
              error={errors?.[language]}
              texts={texts}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
