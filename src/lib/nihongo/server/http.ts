import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = 'HttpError';
  }
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    const details = error.status >= 500 ? undefined : error.details ?? null;
    return NextResponse.json(
      { error: error.message, ...(details === undefined ? {} : { details }) },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid request.', details: error.flatten() }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  // Keep database/provider internals in server logs, not in public responses.
  console.error('[Nihongo Labs API]', error);
  return NextResponse.json({ error: 'Unexpected server error.', message: process.env.NODE_ENV === 'development' ? message : undefined }, { status: 500 });
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new HttpError(503, `Server configuration missing: ${name}`);
  return value;
}

/**
 * Read a request body with a hard byte ceiling while streaming. Checking only
 * after request.text() is too late: the full attacker-controlled body is
 * already allocated by then.
 */
export async function readBodyText(request: Request, maxBytes = 256 * 1024): Promise<string> {
  if (!Number.isInteger(maxBytes) || maxBytes < 0) {
    throw new HttpError(500, 'Invalid request body limit.');
  }
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new HttpError(413, 'Request body is too large.');
  }
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new HttpError(413, 'Request body is too large.');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Could not read request body.');
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new HttpError(400, 'Request body must use valid UTF-8.');
  }
}

export async function readJson<T>(request: Request, parser: { parse(value: unknown): T }, maxBytes = 256 * 1024): Promise<T> {
  const text = await readBodyText(request, maxBytes);
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
  return parser.parse(raw);
}

/** Reject cookie-authenticated mutations initiated by a different browser origin. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return; // Non-browser clients may omit Origin; JWT auth still applies.
  let parsed: URL;
  try { parsed = new URL(origin); }
  catch { throw new HttpError(403, 'Invalid request origin.'); }
  const requestOrigin = new URL(request.url).origin;
  if (parsed.origin !== requestOrigin) throw new HttpError(403, 'Cross-origin request blocked.');
}
