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
    return NextResponse.json({ error: error.message, details: error.details ?? null }, { status: error.status });
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

export async function readJson<T>(request: Request, parser: { parse(value: unknown): T }, maxBytes = 256 * 1024): Promise<T> {
  let text: string;
  try { text = await request.text(); } catch { throw new HttpError(400, 'Could not read request body.'); }
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new HttpError(413, 'Request body is too large.');
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
