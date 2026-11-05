import Markdown, { type Components } from 'react-markdown';

// Only the limited set below can appear. Raw HTML and images are dropped;
// the library address check removes javascript: targets.
const ALLOWED_ELEMENTS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'br'];

// The page owns the only h1, so a text never adds another: its headings start at h2 and stop at h3.
const asH2: Components['h2'] = ({ children }) => <h2>{children}</h2>;
const asH3: Components['h3'] = ({ children }) => <h3>{children}</h3>;

// An address with a host leads off the site (`//host` counts too).
const isExternal = (href: string) => /^(https?:)?\/\//i.test(href);

const components: Components = {
  h1: asH2,
  h2: asH2,
  h3: asH3,
  h4: asH3,
  h5: asH3,
  h6: asH3,
  // The address check leaves an empty href for a refused target; such a link keeps its text and goes nowhere.
  a: ({ href, children }) => (
    <a href={href || undefined} rel={href && isExternal(href) ? 'noopener noreferrer' : undefined}>
      {children}
    </a>
  ),
};

export function MarkdownContent({ children }: { children: string }) {
  return (
    <Markdown allowedElements={ALLOWED_ELEMENTS} unwrapDisallowed skipHtml components={components}>
      {children}
    </Markdown>
  );
}
