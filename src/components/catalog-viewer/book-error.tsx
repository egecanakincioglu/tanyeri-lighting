import { ButtonLink } from '../button.tsx';
import type { ViewerLabels } from './viewer-labels.ts';

export function BookError({ url, labels }: { url: string; labels: Pick<ViewerLabels, 'error' | 'download'> }) {
  return (
    <div className="grid flex-1 place-items-center">
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <p role="alert" className="text-base text-ink">
          {labels.error}
        </p>
        <ButtonLink href={url} download prefetch={false}>
          {labels.download}
        </ButtonLink>
      </div>
    </div>
  );
}
