import { MarkdownField } from './markdown-field.tsx';

type Props = {
  /** The base name: the inputs are `<name>.tr` and `<name>.en`, the keys the Server Actions read. */
  name: string;
  label: string;
  languages: { tr: string; en: string };
  defaultValue?: { tr: string; en: string };
  maxLength?: number;
  errors?: { tr?: string | undefined; en?: string | undefined };
  texts: { hint: string; edit: string; preview: string; loading: string };
};

/** Limited Markdown in Turkish and English, one editor with a preview per language. */
export function BilingualMarkdownField({ name, label, languages, defaultValue, maxLength, errors, texts }: Props) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-base font-bold">{label}</legend>
      <div className="grid gap-6 lg:grid-cols-2">
        {(['tr', 'en'] as const).map((language) => (
          <MarkdownField
            key={language}
            id={`${name}-${language}`}
            name={`${name}.${language}`}
            label={languages[language]}
            lang={language}
            defaultValue={defaultValue?.[language] ?? ''}
            maxLength={maxLength}
            error={errors?.[language]}
            texts={texts}
          />
        ))}
      </div>
    </fieldset>
  );
}
