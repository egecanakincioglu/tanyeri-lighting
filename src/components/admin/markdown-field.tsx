'use client';

import { lazy, Suspense, useState } from 'react';
import { TextAreaField } from '../field.tsx';

// The preview uses the same component as the public pages, so what shows here is what the visitor gets. It is loaded
// the first time someone asks for it: the library is not part of the form's own bundle.
const MarkdownPreview = lazy(() => import('./markdown-preview.tsx'));

type MarkdownFieldTexts = {
  /** The allowed syntax in one short line. */
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
  /** Defaults to true. */
  required?: boolean;
  error?: string | undefined;
  texts: MarkdownFieldTexts;
};

const tabClass =
  'min-h-touch rounded-md border border-hairline px-4 text-sm font-semibold aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent-text';

/** A text area for limited Markdown with a hint of the syntax and a preview toggle. */
export function MarkdownField({ id, name, label, defaultValue = '', maxLength, required = true, error, texts }: Props) {
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
      {/* Hidden, not removed, so the text is still submitted while the preview shows. */}
      <div hidden={previewing}>
        <TextAreaField
          id={id}
          name={name}
          label={label}
          value={value}
          maxLength={maxLength}
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
