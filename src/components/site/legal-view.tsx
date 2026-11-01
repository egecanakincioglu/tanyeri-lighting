import { Container } from '../container.tsx';
import { MarkdownContent } from '../markdown-content.tsx';
import { SectionTitle } from '../section-title.tsx';
import { PROSE } from './prose.ts';

const bodyClass = `mx-auto max-w-3xl pb-[clamp(2.5rem,6vw,4.5rem)] break-words ${PROSE}`;

/** A legal page: the title is the page heading, the body is stored Markdown. */
export function LegalView({ title, body }: { title: string; body: string }) {
  return (
    <>
      <SectionTitle title={title} level={1} />
      <Container>
        <div className={bodyClass}>
          <MarkdownContent>{body}</MarkdownContent>
        </div>
      </Container>
    </>
  );
}
