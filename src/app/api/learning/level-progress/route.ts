import { connection, NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);

    const level = request.nextUrl.searchParams.get('level') || 'N5';
    if (!['N5', 'N4'].includes(level)) throw new HttpError(400, 'Unsupported JLPT level.');

    const { data, error } = await context.supabase.rpc('get_level_progress', { _level: level });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      throw new HttpError(500, 'Could not calculate progress for this JLPT level.', error?.message);
    }

    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
