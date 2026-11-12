import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/nihongo/server/admin';
import { createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';

const updateSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['contact', 'ticket']),
  status: z.string().min(1).max(40),
}).strict();

export async function GET() {
  await connection();
  try {
    await requireAdminApi();
    const admin = createAdminSupabase();
    const [contacts, tickets] = await Promise.all([
      admin.from('contact_messages').select('id,user_id,name,email,subject,message,status,created_at').order('created_at', { ascending: false }).limit(100),
      admin.from('support_tickets').select('id,user_id,requester_email,subject,category,priority,status,created_at,updated_at').order('created_at', { ascending: false }).limit(100),
    ]);
    if (contacts.error) throw contacts.error;
    if (tickets.error) throw tickets.error;
    return NextResponse.json({ contacts: contacts.data ?? [], tickets: tickets.data ?? [] }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  await connection();
  try {
    assertSameOrigin(request);
    const context = await requireAdminApi(['super_admin', 'admin', 'support_agent']);
    const input = await readJson(request, updateSchema);
    const admin = createAdminSupabase();
    const allowed = input.kind === 'contact'
      ? ['new', 'read', 'replied', 'closed']
      : ['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed'];
    if (!allowed.includes(input.status)) throw new HttpError(400, 'Invalid status for this inbox item.');

    const { error } = await admin.rpc('admin_update_inbox_status_with_audit', {
      _kind: input.kind,
      _record_id: input.id,
      _status: input.status,
      _actor_user_id: context.user.id,
    });
    if (error) throw new HttpError(error.code === 'P0002' ? 404 : 500,
      error.code === 'P0002' ? 'Inbox item not found.' : 'Could not update inbox status and audit event.',
      error.message);

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
