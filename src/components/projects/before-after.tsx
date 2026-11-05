'use client';

import { useId, useState } from 'react';
import { eagerWhen, SiteImage } from '../site-image.tsx';

type BeforeAfterProps = {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel: string;
  afterLabel: string;
  label: string;
  /** Spoken value with the placeholders `{before}` and `{after}`, which become the two percentages. */
  valueText: string;
  name: string;
  sizes: string;
  eager?: boolean;
};

/** A native range input lies over the photos, so pointer drag and keyboard come from the browser. */
export function BeforeAfter({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
  label,
  valueText,
  name,
  sizes,
  eager = false,
}: BeforeAfterProps) {
  const id = useId();
  const [value, setValue] = useState(50);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm text-muted">
        {label}
      </label>
      <div className="relative aspect-2/1 overflow-hidden rounded-lg border border-hairline bg-surface has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-text">
        <SiteImage src={afterUrl} alt={`${name}, ${afterLabel}`} fill sizes={sizes} {...eagerWhen(eager)} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}>
          <SiteImage src={beforeUrl} alt={`${name}, ${beforeLabel}`} fill sizes={sizes} {...eagerWhen(eager)} />
        </div>
        <span
          aria-hidden="true"
          className="absolute top-3 left-3 rounded-md bg-black/70 px-2.5 py-1 text-sm font-semibold text-white"
        >
          {beforeLabel}
        </span>
        <span
          aria-hidden="true"
          className="absolute top-3 right-3 rounded-md bg-black/70 px-2.5 py-1 text-sm font-semibold text-white"
        >
          {afterLabel}
        </span>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-md"
          style={{ left: `${value}%` }}
        >
          <span className="absolute top-1/2 left-1/2 grid size-10 -translate-1/2 place-items-center rounded-full bg-white text-ink shadow-md">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 7-5 5 5 5M15 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          aria-valuetext={valueText.replace('{before}', String(value)).replace('{after}', String(100 - value))}
          className="absolute inset-0 size-full cursor-ew-resize touch-pan-y appearance-none bg-transparent opacity-0 [&::-moz-range-thumb]:w-px [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:w-px [&::-webkit-slider-thumb]:appearance-none"
        />
      </div>
    </div>
  );
}
