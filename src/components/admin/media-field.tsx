'use client';

import { useRef, useState, useTransition } from 'react';
import type { FormState } from '../../server/admin/form.ts';
import { Button } from '../button.tsx';
import { SiteImage } from '../site-image.tsx';
import { ActionIcon } from './action-icons.tsx';
import { AdminIcon } from './icons.tsx';
import type { FormTexts } from './texts.ts';

export type MediaTexts = {
  choose: string;
  replace: string;
  clear: string;
  uploading: string;
  /** Said when nothing is chosen yet. */
  none: string;
  /** The accepted types and the size limit, as a short hint. */
  hint: string;
  /** Names the stored file in the file variant. */
  open: string;
};

type UploadAction = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  id: string;
  /** The hidden input that carries the stored address to the Server Action. */
  name: string;
  label: string;
  defaultValue?: string;
  upload: UploadAction;
  texts: MediaTexts;
  errors: FormTexts['errors'];
  maxBytes: number;
  /** Set when uploads are off (no file store, or the demo): the reason, shown instead of the choose button's action. */
  disabledReason?: string | undefined;
  /** Shows the picture as an A4 portrait page instead of a landscape photo. */
  portrait?: boolean;
  /** Already translated message of the form's own validation. */
  error?: string | undefined;
};

type Kind = 'image' | 'file';

const ACCEPT: Record<Kind, string> = {
  image: 'image/jpeg,image/png,image/webp',
  file: 'application/pdf',
};

// The server checks size and real type again; this only spares the visitor a round trip.
function MediaField({ kind, ...props }: Props & { kind: Kind }) {
  const {
    id,
    name,
    label,
    defaultValue = '',
    upload,
    texts,
    errors,
    maxBytes,
    disabledReason,
    error,
    portrait,
  } = props;
  const [url, setUrl] = useState(defaultValue);
  const [problem, setProblem] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function onChoose(file: File | undefined) {
    if (!file) return;
    setProblem(undefined);
    if (file.size > maxBytes) {
      setProblem(errors.tooLarge);
      return;
    }
    if (!ACCEPT[kind].split(',').includes(file.type)) {
      setProblem(errors.unsupportedType);
      return;
    }
    const data = new FormData();
    data.set('file', file);
    startTransition(async () => {
      const result = await upload(null, data);
      if (result.status === 'success' && result.url) setUrl(result.url);
      else if (result.status === 'error') setProblem(errors[result.code]);
      if (input.current) input.current.value = '';
    });
  }

  const messageId = `${id}-message`;
  const message = problem ?? error;
  const disabled = Boolean(disabledReason) || pending;

  const previewBox = portrait ? 'aspect-[210/297] w-28' : 'aspect-4/3 w-40';

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-semibold">
        {label}
      </span>
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-wrap items-center gap-4 rounded-lg border-2 border-dashed border-hairline bg-page/60 p-4">
        {kind === 'image' ? (
          <div
            className={`relative grid flex-none place-items-center overflow-hidden rounded-md border border-hairline bg-surface text-muted ${previewBox}`}
          >
            {url ? (
              <SiteImage src={url} alt="" fill sizes={portrait ? '112px' : '160px'} />
            ) : (
              <AdminIcon name="image" className="size-8" />
            )}
          </div>
        ) : (
          <div className="grid size-16 flex-none place-items-center rounded-md border border-hairline bg-surface text-muted">
            <AdminIcon name="doc" className="size-8" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-3">
          {kind === 'file' ? (
            <p className="text-sm break-all">
              {url ? (
                <a href={url} target="_blank" rel="noopener" className="font-medium text-accent-text underline">
                  {texts.open}
                </a>
              ) : (
                <span className="text-muted">{texts.none}</span>
              )}
            </p>
          ) : (
            !url && <p className="text-sm text-muted">{texts.none}</p>
          )}
          <input
            ref={input}
            id={id}
            type="file"
            accept={ACCEPT[kind]}
            tabIndex={-1}
            aria-labelledby={`${id}-label`}
            aria-describedby={messageId}
            className="sr-only"
            disabled={disabled}
            onChange={(event) => onChoose(event.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
              <ActionIcon name="upload" className="size-4" />
              {pending ? texts.uploading : url ? texts.replace : texts.choose}
            </Button>
            {url && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setUrl('')}
                className="inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-md border border-transparent px-4 text-[0.9375rem] font-semibold text-muted transition-colors duration-200 hover:bg-error/10 hover:text-error focus-visible:bg-error/10 focus-visible:text-error disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent motion-reduce:transition-none"
              >
                <ActionIcon name="trash" className="size-4" />
                {texts.clear}
              </button>
            )}
          </div>
          <p className="text-sm text-muted">{disabledReason ?? texts.hint}</p>
        </div>
      </div>
      <p id={messageId} role="alert" className="text-sm font-medium text-error">
        {message}
      </p>
    </div>
  );
}

export function ImageField(props: Props) {
  return <MediaField kind="image" {...props} />;
}

export function FileField(props: Props) {
  return <MediaField kind="file" {...props} />;
}
