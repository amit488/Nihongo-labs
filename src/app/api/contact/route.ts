import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';

const contactMessageSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  subject: z.enum(['Suggestion', 'Complaint', 'Bug report', 'Other']),
  message: z.string().trim().min(5).max(10000),
  website: z.string().max(200).optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = await readJson(request, contactMessageSchema, 16 * 1024);

    // Quietly accept honeypot submissions without storing them.
    if (input.website) return NextResponse.json({ ok: true });

    const supabase = await createServerSupabase();
    const { data: authData } = await supabase.auth.getUser();
    const record = {
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      ...(authData.user ? { user_id: authData.user.id } : {}),
    };
    const { error } = await supabase.from('contact_messages').insert(record);
    if (error) {
      console.error('[Nihongo Labs contact submission]', error);
      throw new HttpError(500, 'We could not send your message right now. Please try again.');
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
