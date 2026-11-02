/** How the browser is told to fetch each picture in the rendered markup, in document order: "loading/fetchpriority". */
export function imageLoading(container: ParentNode): string[] {
  return [...container.querySelectorAll('img')].map(
    (img) => `${img.getAttribute('loading')}/${img.getAttribute('fetchpriority')}`,
  );
}
