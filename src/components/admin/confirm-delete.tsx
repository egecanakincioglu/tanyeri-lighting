'use client';

import { useActionState, useId, useRef } from 'react';
import type { FormState } from '../../server/admin/form.ts';
import { Button } from '../button.tsx';
import { FormStatus } from './form-status.tsx';
import { SubmitButton } from './submit-button.tsx';
import type { FormTexts } from './texts.ts';

export type ConfirmDeleteTexts = {
  /** The label of the button that opens the dialog. */
  trigger: string;
  title: string;
  /** Holds `{name}`, replaced with what will be deleted. */
  body: string;
  confirm: string;
  working: string;
  cancel: string;
};

type Props = {
  /** What will be deleted, shown in the dialog. */
  name: string;
  /** Hidden fields the action needs, such as the id and the language. */
  fields: Record<string, string>;
  action: (previous: FormState | null, formData: FormData) => Promise<FormState>;
  texts: ConfirmDeleteTexts;
  formTexts: Pick<FormTexts, 'saved' | 'errors'>;
  /** The reason the button is off (the demo); the server refuses the delete anyway. */
  disabledReason?: string | undefined;
};

/** A delete button that asks first, in a native modal dialog. Escape and the cancel button close it. */
export function ConfirmDelete({ name, fields, action, texts, formTexts, disabledReason }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(action, null);
  const titleId = useId();
  const bodyId = useId();
  const reasonId = useId();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        aria-label={`${texts.trigger}: ${name}`}
        aria-describedby={disabledReason ? reasonId : undefined}
        disabled={Boolean(disabledReason)}
        onClick={() => dialog.current?.showModal()}
      >
        {texts.trigger}
      </Button>
      {disabledReason && (
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="m-auto w-[min(92vw,26rem)] rounded-lg border border-hairline bg-surface p-6 text-ink shadow-lg backdrop:bg-black/40"
      >
        <form action={formAction} className="flex flex-col gap-4">
          {Object.entries(fields).map(([field, value]) => (
            <input key={field} type="hidden" name={field} value={value} />
          ))}
          <h2 id={titleId} className="text-lg font-bold">
            {texts.title}
          </h2>
          <p id={bodyId} className="wrap-break-word">
            {texts.body.replace('{name}', name)}
          </p>
          <FormStatus state={state} texts={formTexts} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>
              {texts.cancel}
            </Button>
            <SubmitButton label={texts.confirm} pendingLabel={texts.working} />
          </div>
        </form>
      </dialog>
    </>
  );
}
