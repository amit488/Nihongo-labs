import { connection, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';

export async function GET() {
  await connection();
  const context = await requireUser();
  return NextResponse.json({ signedIn: context.ok });
}
