import { ZodError } from 'zod';
import { UnauthorizedError } from '../auth/guard.ts';
import { DemoModeError } from '../demo/guard.ts';
import {
  CatalogInUseError,
  CategoryLimitError,
  CategoryNotEmptyError,
  ContentNotFoundError,
  InvalidOrderError,
  ValueTakenError,
} from '../content/errors.ts';
import { StorageDisabledError, UploadRejectedError } from '../storage/index.ts';

// What every panel Server Action hands back to its form. The texts live in messages/*.json (AdminForm); the server
// only names the case, so the language of the page decides the wording and no raw error text reaches the browser.

export type FieldError = { code: 'required' | 'tooLong' | 'invalid'; max?: number };

export type ErrorCode =
  | 'invalid'
  | 'demo'
  | 'unauthorized'
  | 'notFound'
  | 'invalidOrder'
  | 'taken'
  | 'conflict'
  | 'storageOff'
  | 'tooLarge'
  | 'unsupportedType'
  | 'unreadableImage'
  | 'generic';

export type FormState =
  { status: 'success'; url?: string } | { status: 'error'; code: ErrorCode; fieldErrors: Record<string, FieldError> };

const NO_FIELDS: Record<string, FieldError> = {};

export function failure(code: ErrorCode, fieldErrors: Record<string, FieldError> = NO_FIELDS): FormState {
  return { status: 'error', code, fieldErrors };
}

// The first issue per field. A bilingual field is `title.tr` and `title.en`, which are the names of its inputs.
function fieldErrorsOf(error: ZodError): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (path === '' || path in errors) continue;
    if (issue.code === 'too_big') errors[path] = { code: 'tooLong', max: Number(issue.maximum) };
    else if (issue.code === 'too_small') errors[path] = { code: 'required' };
    else errors[path] = { code: 'invalid' };
  }
  return errors;
}

const REJECTIONS = {
  'too-large': 'tooLarge',
  'unsupported-type': 'unsupportedType',
  'unreadable-image': 'unreadableImage',
} as const;

function mapError(error: unknown): FormState {
  if (error instanceof ZodError) return failure('invalid', fieldErrorsOf(error));
  if (error instanceof DemoModeError) return failure('demo');
  if (error instanceof UnauthorizedError) return failure('unauthorized');
  if (error instanceof ContentNotFoundError) return failure('notFound');
  if (error instanceof InvalidOrderError) return failure('invalidOrder');
  if (error instanceof ValueTakenError) return failure('taken');
  if (
    error instanceof CategoryLimitError ||
    error instanceof CategoryNotEmptyError ||
    error instanceof CatalogInUseError
  ) {
    return failure('conflict');
  }
  if (error instanceof StorageDisabledError) return failure('storageOff');
  if (error instanceof UploadRejectedError) return failure(REJECTIONS[error.reason]);
  // The real cause stays in the server log; the form only says that something went wrong.
  console.error('Admin action failed', error);
  return failure('generic');
}

// Runs the body of a Server Action. Each action calls guardAction() itself inside `work`
// (tooling/scripts/check-admin-guard.ts looks for it in the action), so the guard's error ends up here too.
export async function runAction(work: () => Promise<FormState | void>): Promise<FormState> {
  try {
    return (await work()) ?? { status: 'success' };
  } catch (error) {
    return mapError(error);
  }
}

export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

// The two inputs of a bilingual field are named `<name>.tr` and `<name>.en`.
export function formPair(formData: FormData, name: string): { tr: string; en: string } {
  return { tr: formText(formData, `${name}.tr`), en: formText(formData, `${name}.en`) };
}
