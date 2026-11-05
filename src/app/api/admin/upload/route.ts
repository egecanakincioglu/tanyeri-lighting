import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { guardHandler } from '../../../../server/auth/guard.ts';
import { demoModeResponse, assertWritable } from '../../../../server/demo/guard.ts';
import { getBlobToken } from '../../../../server/env.ts';
import { MAX_PDF_BYTES, TMP_PREFIX } from '../../../../lib/upload-limits.ts';

// The token lasts a few minutes; the browser asks for it right before the upload.
const TOKEN_VALID_MS = 5 * 60 * 1000;
const TEMPORARY_NAME = new RegExp(`^${TMP_PREFIX}[A-Za-z0-9._-]{1,100}$`);

// Step one of an upload: gives the browser a short-lived token to write one file to the store's tmp/ folder.
// The file skips the server because Vercel refuses bodies over 4.5 MB; finalizeMediaAction then checks and moves it.
// No completion callback: it cannot reach a development machine.
export async function POST(request: Request): Promise<Response> {
  const session = await guardHandler();
  if (session instanceof Response) return session;
  try {
    assertWritable();
  } catch (error) {
    const refusal = demoModeResponse(error);
    if (refusal) return refusal;
    throw error;
  }
  const token = getBlobToken();
  if (token === undefined) return Response.json({ error: 'File storage is off' }, { status: 503 });

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  try {
    return Response.json(
      await handleUpload({
        token,
        request,
        body,
        onBeforeGenerateToken: async (pathname) => {
          if (!TEMPORARY_NAME.test(pathname)) throw new Error('Only the temporary folder accepts uploads');
          return {
            allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
            maximumSizeInBytes: MAX_PDF_BYTES,
            addRandomSuffix: true,
            validUntil: Date.now() + TOKEN_VALID_MS,
          };
        },
      }),
    );
  } catch {
    return Response.json({ error: 'Upload not allowed' }, { status: 400 });
  }
}
