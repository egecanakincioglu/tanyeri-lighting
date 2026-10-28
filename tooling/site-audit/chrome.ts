const LINUX = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
const WINDOWS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

/** CHROME_PATH wins; otherwise the first known install location that exists, or null. */
export function findChrome(
  env: Record<string, string | undefined>,
  platform: string,
  exists: (p: string) => boolean,
): string | null {
  if (env.CHROME_PATH) return env.CHROME_PATH;
  const candidates = platform === 'win32' ? WINDOWS : LINUX;
  return candidates.find(exists) ?? null;
}
