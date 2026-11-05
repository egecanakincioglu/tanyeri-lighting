'use client';

import { lazy, Suspense, useState } from 'react';
import { TextAreaField } from '../field.tsx';

// Loaded on first use, so the Markdown library stays out of the form bundle.
const MarkdownPreview = lazy(() => import('./markdown-preview.tsx'));

type MarkdownFieldTexts = {
  hint: string;
  edit: string;
  preview: string;
  loading: string;
};

type Props = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  maxLength?: number;
  lang?: string;
  required?: boolean;
  error?: string | undefined;
  texts: MarkdownFieldTexts;
};

const tabClass =
  'min-h-touch rounded-md border border-hairline px-4 text-sm font-semibold aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent-text';

export function MarkdownField({
  id,
  name,
  label,
  defaultValue = '',
  maxLength,
  lang,
  required = true,
  error,
  texts,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [previewing, setPreviewing] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2" role="group">
        <button type="button" aria-pressed={!previewing} onClick={() => setPreviewing(false)} className={tabClass}>
          {texts.edit}
        </button>
        <button type="button" aria-pressed={previewing} onClick={() => setPreviewing(true)} className={tabClass}>
          {texts.preview}
        </button>
      </div>
      {/* Hidden, not removed, so the text is still submitted. */}
      <div hidden={previewing}>
        <TextAreaField
          id={id}
          name={name}
          label={label}
          value={value}
          maxLength={maxLength}
          lang={lang}
          required={required}
          error={error}
          onChange={(event) => setValue(event.target.value)}
        />
        <p className="mt-1.5 text-sm text-muted">{texts.hint}</p>
      </div>
      {previewing && (
        <div className="min-h-40 rounded-md border border-hairline bg-surface px-4 py-3">
          <Suspense fallback={<p className="text-muted">{texts.loading}</p>}>
            <MarkdownPreview>{value}</MarkdownPreview>
          </Suspense>
        </div>
      )}
    </div>
  );
}
