// The picture an image element asks the optimizer for: the `url` of its `/_next/image` source.
export function optimizedSource(img: Element): string | null {
  return new URL(img.getAttribute('src') ?? '', 'http://localhost').searchParams.get('url');
}
