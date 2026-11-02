import { MarkdownContent } from '../markdown-content.tsx';
import { PROSE } from '../site/prose.ts';

/** Loaded on demand by MarkdownField, so the Markdown library stays out of the first load of every form. */
export default function MarkdownPreview({ children }: { children: string }) {
  return (
    <div className={PROSE}>
      <MarkdownContent>{children}</MarkdownContent>
    </div>
  );
}
