import type { ComponentProps } from 'react';

type ContainerProps = Omit<ComponentProps<'div'>, 'className'>;

/** Content never gets closer to the screen edge than the gutter and never wider than the page width. */
export function Container(props: ContainerProps) {
  return <div className="mx-auto w-[min(100%-2*var(--gutter),var(--container-page))]" {...props} />;
}
