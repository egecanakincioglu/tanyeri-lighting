import { MarkdownContent } from '../markdown-content.tsx';
import { PROSE } from '../site/prose.ts';

/** Loaded on demand, so the Markdown library stays out of every form bundle. */
export default function MarkdownPreview({ children }: { children: string }) {
  return (
    <div className={PROSE}>
      <MarkdownContent>{children}</MarkdownContent>
    </div>
  );
}
