import type { ComponentProps, ReactNode } from 'react';

const controlClass =
  'block w-full rounded-md border border-hairline bg-surface px-4 py-3 text-base text-ink placeholder:text-muted aria-invalid:border-error';

type FieldProps = {
  id: string;
  label: string;
  /** Already translated; shown under the control and tied to it for screen readers. */
  error?: string;
};

function Frame({ id, label, error, children }: FieldProps & { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = FieldProps & Omit<ComponentProps<'input'>, 'className' | 'id' | 'aria-invalid'>;

export function TextField({ id, label, error, ...rest }: TextFieldProps) {
  return (
    <Frame id={id} label={label} error={error}>
      <input
        id={id}
        className={`${controlClass} min-h-touch`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
    </Frame>
  );
}

type SelectFieldProps = FieldProps &
  Omit<ComponentProps<'select'>, 'className' | 'id' | 'aria-invalid' | 'children'> & {
    options: readonly { value: string; label: string }[];
  };

export function SelectField({ id, label, error, options, ...rest }: SelectFieldProps) {
  return (
    <Frame id={id} label={label} error={error}>
      <select
        id={id}
        className={`${controlClass} min-h-touch`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Frame>
  );
}

type TextAreaFieldProps = FieldProps & Omit<ComponentProps<'textarea'>, 'className' | 'id' | 'aria-invalid'>;

export function TextAreaField({ id, label, error, ...rest }: TextAreaFieldProps) {
  return (
    <Frame id={id} label={label} error={error}>
      <textarea
        id={id}
        className={`${controlClass} min-h-40 resize-y`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...rest}
      />
    </Frame>
  );
}
