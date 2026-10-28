export function A({ html }: { html: string }) {
  // ruleid: no-dangerous-html
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function B({ text }: { text: string }) {
  // ok: no-dangerous-html
  return <div>{text}</div>;
}
