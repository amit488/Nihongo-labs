import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';

// Authenticated routes read request cookies and must not be prerendered.
export const dynamic = 'force-dynamic';

export async function GET() {
  const context = await requireUser();
  return NextResponse.json({ signedIn: context.ok });
}
