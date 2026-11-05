import type { ComponentProps } from 'react';

type ContainerProps = Omit<ComponentProps<'div'>, 'className'>;

export function Container(props: ContainerProps) {
  return <div className="mx-auto w-[min(100%-2*var(--gutter),var(--container-page))]" {...props} />;
}
