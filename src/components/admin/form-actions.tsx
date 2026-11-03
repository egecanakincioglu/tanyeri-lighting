import type { ReactNode } from 'react';
import type { FormState } from '../../server/admin/form.ts';
import { AdminIcon } from './icons.tsx';
import { FormStatus } from './form-status.tsx';
import type { FormTexts } from './texts.ts';

type Props = {
  state: FormState | null;
  texts: Pick<FormTexts, 'saved' | 'errors'>;
  /** Why saving is off (the demo); shown next to the buttons. */
  note?: string | undefined;
  /** The save button and the cancel link. */
  children: ReactNode;
};

/** The bar at the end of a form. It sticks to the bottom of the screen on long forms, in plain CSS. */
export function FormActions({ state, texts, note, children }: Props) {
  return (
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-hairline bg-surface px-4 py-3 shadow-[0_-6px_16px_-8px_rgb(0_0_0/0.18)] sm:px-5">
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      <FormStatus state={state} texts={texts} />
      {note && (
        <p className="flex min-w-0 basis-full items-start gap-2 text-sm text-muted sm:flex-1 sm:basis-64">
          <AdminIcon name="info" className="mt-0.5 size-4 flex-none" />
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}
