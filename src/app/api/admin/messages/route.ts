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

    const table = input.kind === 'contact' ? 'contact_messages' : 'support_tickets';
    const patch = input.kind === 'contact'
      ? { status: input.status }
      : { status: input.status, updated_at: new Date().toISOString(), ...(input.status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) };
    const { error } = await admin.from(table).update(patch).eq('id', input.id);
    if (error) throw error;

    const { error: auditError } = await admin.from('audit_logs').insert({
      actor_user_id: context.user.id,
      action: 'admin.inbox.status_updated',
      target_table: table,
      target_id: input.id,
      details: { status: input.status },
    });
    if (auditError) console.error('[Nihongo Labs admin audit]', auditError);

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
