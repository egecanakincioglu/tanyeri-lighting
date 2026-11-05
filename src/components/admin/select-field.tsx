import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<'select'>, 'className' | 'id' | 'aria-invalid'> & {
  id: string;
  label: string;
  options: readonly { value: string; label: string }[];
  error?: string | undefined;
};

export function SelectField({ id, label, options, error, ...rest }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={id}
        className="block min-h-touch w-full rounded-md border border-hairline bg-surface px-4 py-3 text-base text-ink aria-invalid:border-error"
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
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}
