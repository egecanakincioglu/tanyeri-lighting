import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

export interface FakeBlobServer {
  url: string;
  requests: RecordedRequest[];
  // The next response is a Vercel Blob API error with this code (and HTTP status) instead of success.
  failNextWith(code: string, status: number): void;
  close(): Promise<void>;
}

// Stands in for the Vercel Blob HTTP API: the real SDK (and its HTTP client) runs against it, only the network ends here.
export async function startFakeBlobServer(): Promise<FakeBlobServer> {
  const requests: RecordedRequest[] = [];
  let failure: { code: string; status: number } | null = null;
  const sizes = new Map<string, number>();

  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const recorded: RecordedRequest = {
        method: request.method ?? '',
        url: request.url ?? '',
        headers: request.headers,
        body: Buffer.concat(chunks),
      };
      requests.push(recorded);
      response.setHeader('content-type', 'application/json');
      if (failure) {
        const { code, status } = failure;
        failure = null;
        response.statusCode = status;
        response.end(JSON.stringify({ error: { code, message: 'fake failure' } }));
        return;
      }
      if (recorded.method === 'PUT') {
        const pathname = new URL(recorded.url, 'http://fake').searchParams.get('pathname') ?? '';
        const url = `https://store.public.blob.vercel-storage.com/${pathname}`;
        sizes.set(url, recorded.body.byteLength);
        response.end(
          JSON.stringify({
            url,
            downloadUrl: `${url}?download=1`,
            pathname,
            contentType: recorded.headers['x-content-type'],
            contentDisposition: `inline; filename="${pathname}"`,
            etag: '"fake"',
          }),
        );
        return;
      }
      if (recorded.method === 'GET') {
        const url = new URL(recorded.url, 'http://fake').searchParams.get('url') ?? '';
        const size = sizes.get(url);
        if (size === undefined) {
          response.statusCode = 404;
          response.end(JSON.stringify({ error: { code: 'not_found', message: 'The requested blob does not exist' } }));
          return;
        }
        response.end(
          JSON.stringify({
            url,
            downloadUrl: `${url}?download=1`,
            pathname: new URL(url).pathname.slice(1),
            contentType: 'application/pdf',
            contentDisposition: 'inline',
            cacheControl: 'public, max-age=31536000',
            size,
            uploadedAt: new Date().toISOString(),
          }),
        );
        return;
      }
      response.end('{}');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    failNextWith(code, status) {
      failure = { code, status };
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
