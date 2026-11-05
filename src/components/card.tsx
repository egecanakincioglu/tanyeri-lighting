import type { ComponentProps } from 'react';

/** Put the hover shadow on a div around the Card so it follows the rounded corners. */
export const CARD_FRAME =
  'h-full rounded-lg duration-300 motion-safe:transition-shadow motion-safe:hover:shadow-[0_8px_16px_rgb(0_0_0/0.12)] motion-safe:hover:[&>article]:shadow-none';

type CardProps = Omit<ComponentProps<'article'>, 'className'>;

export function Card(props: CardProps) {
  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-lg border border-hairline bg-surface transition-shadow duration-300 hover:shadow-md"
      {...props}
    />
  );
}
