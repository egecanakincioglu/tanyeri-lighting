import type { ComponentProps } from 'react';

type CardProps = Omit<ComponentProps<'article'>, 'className'>;

/** A white panel that clips its photo to the rounded corners; the caller lays out the inside. */
export function Card(props: CardProps) {
  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-lg border border-hairline bg-surface transition-shadow duration-300 hover:shadow-md"
      {...props}
    />
  );
}
