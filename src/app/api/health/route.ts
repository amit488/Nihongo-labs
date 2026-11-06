import { connection, NextResponse } from 'next/server';


export async function GET() {
  await connection();
  return NextResponse.json({ ok: true, service: 'nihongo-labs', timestamp: new Date().toISOString() });
}
