export function optimizedSource(img: Element): string | null {
  return new URL(img.getAttribute('src') ?? '', 'http://localhost').searchParams.get('url');
}
