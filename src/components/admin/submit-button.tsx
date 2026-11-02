'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '../button.tsx';

type Props = Omit<ComponentProps<typeof Button>, 'type' | 'children'> & {
  label: string;
  pendingLabel: string;
  /** For a form that is submitted from code, where the form itself does not report that it is pending. */
  pending?: boolean;
};

/** The submit button of a form: disabled and relabelled while the Server Action runs. */
export function SubmitButton({ label, pendingLabel, disabled, pending: submitting = false, ...rest }: Props) {
  const status = useFormStatus();
  const pending = status.pending || submitting;
  return (
    <Button type="submit" disabled={disabled || pending} {...rest}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
