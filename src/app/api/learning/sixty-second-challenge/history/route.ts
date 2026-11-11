import { connection, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

export async function GET() {
  await connection();
  try {
    const context=await requireUser();
    if(!context.ok) throw new HttpError(401,context.error);
    const {data,error}=await context.supabase.from('sixty_second_challenge_attempts')
      .select('id,score_percentage,total_answered,total_correct,duration_seconds,category_scores,answer_review,created_at')
      .eq('user_id',context.user.id).order('created_at',{ascending:false}).limit(30);
    if(error) {
      if(['42P01','PGRST205'].includes(error.code??'')) return NextResponse.json({attempts:[],totalAttempts:0,migrationRequired:true},{headers:{'Cache-Control':'private,no-store'}});
      throw new HttpError(500,'Could not load your 60-second challenge history.',error.message);
    }
    const attempts=data??[];
    const {count,error:countError}=await context.supabase.from('sixty_second_challenge_attempts').select('id',{count:'exact',head:true}).eq('user_id',context.user.id);
    if(countError) throw new HttpError(500,'Could not count your challenge attempts.',countError.message);
    return NextResponse.json({attempts,totalAttempts:count??attempts.length},{headers:{'Cache-Control':'private,no-store'}});
  } catch(error) { return jsonError(error); }
}
