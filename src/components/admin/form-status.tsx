import type { FormState } from '../../server/admin/form.ts';
import type { FormTexts } from './texts.ts';

type Props = { state: FormState | null; texts: Pick<FormTexts, 'saved' | 'errors'>; successText?: string };

/** Success and failure of the last submit. Both regions stay in the page so a screen reader announces a change. */
export function FormStatus({ state, texts, successText }: Props) {
  const failed = state?.status === 'error' ? state : null;
  return (
    <>
      <div role="status" className="contents">
        {state?.status === 'success' && (
          <p className="rounded-md bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            {successText ?? texts.saved}
          </p>
        )}
      </div>
      <div role="alert" className="contents">
        {failed && (
          <p className="rounded-md bg-error/10 px-3 py-2 text-sm font-semibold text-error">
            {texts.errors[failed.code]}
          </p>
        )}
      </div>
    </>
  );
}
