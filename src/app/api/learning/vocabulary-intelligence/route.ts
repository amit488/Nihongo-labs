import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const parsed = z.enum(['N5', 'N4']).safeParse(request.nextUrl.searchParams.get('level') || 'N5');
    if (!parsed.success) throw new HttpError(400, 'Choose N5 or N4.');

    const { data, error } = await context.supabase.rpc('get_vocabulary_intelligence', {
      _level: parsed.data,
    });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      throw new HttpError(500, 'Could not load vocabulary intelligence.', error?.message);
    }

    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
