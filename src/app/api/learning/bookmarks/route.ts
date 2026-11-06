import { connection, NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { bookmarkSchema } from '@/lib/nihongo/server/validation';



export async function GET() {
  try {
    await connection();
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const { data, error } = await context.supabase.from('user_bookmarks').select('id,resource_type,resource_id,created_at').eq('user_id', context.user.id).order('created_at', { ascending: false });
    if (error) throw new HttpError(500, 'Could not load bookmarks.', error.message);
    return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, bookmarkSchema);
    const { data, error } = await context.supabase.from('user_bookmarks').upsert({ user_id: context.user.id, resource_type: input.resourceType, resource_id: input.resourceId }, { onConflict: 'user_id,resource_type,resource_id', ignoreDuplicates: true }).select().maybeSingle();
    if (error) throw new HttpError(500, 'Could not save bookmark.', error.message);
    return NextResponse.json({ saved: true, bookmark: data });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, bookmarkSchema);
    const { error } = await context.supabase.from('user_bookmarks').delete().eq('user_id', context.user.id).eq('resource_type', input.resourceType).eq('resource_id', input.resourceId);
    if (error) throw new HttpError(500, 'Could not remove bookmark.', error.message);
    return NextResponse.json({ removed: true });
  } catch (error) { return jsonError(error); }
}
