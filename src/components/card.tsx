import type { ComponentProps } from 'react';

/** The soft shadow a card casts on hover; put it on a div around the Card so the shadow follows the rounded corners. */
export const CARD_FRAME =
  'h-full rounded-lg duration-300 motion-safe:transition-shadow motion-safe:hover:shadow-[0_8px_16px_rgb(0_0_0/0.12)] motion-safe:hover:[&>article]:shadow-none';

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
