import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/nihongo/server/admin';
import { createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { jsonError } from '@/lib/nihongo/server/http';

export const dynamic = 'force-dynamic';

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    await requireAdminApi();
    const admin = createAdminSupabase();
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const weekStart = isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)));

    const count = async (table: string, column = 'id') => {
      const { count: total, error } = await admin.from(table).select(column, { count: 'exact', head: true });
      if (error) throw error;
      return total ?? 0;
    };

    const [
      usersTotal,
      newUsers,
      subscriptionsActive,
      openMessages,
      openTickets,
      courses,
      lessons,
      vocabulary,
      kanji,
      grammar,
      dailyActivityResult,
      monthlyPaymentsResult,
      recentUsersResult,
      recentPaymentsResult,
      recentMessagesResult,
      plansResult,
    ] = await Promise.all([
      count('profiles'),
      admin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthStart).then(({ count: total, error }) => {
        if (error) throw error;
        return total ?? 0;
      }),
      admin.from('subscriptions').select('id', { count: 'exact', head: true }).in('status', ['active', 'trialing']).then(({ count: total, error }) => {
        if (error) throw error;
        return total ?? 0;
      }),
      admin.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new').then(({ count: total, error }) => {
        if (error) throw error;
        return total ?? 0;
      }),
      admin.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress', 'waiting_for_user']).then(({ count: total, error }) => {
        if (error) throw error;
        return total ?? 0;
      }),
      count('courses'),
      count('lessons'),
      count('vocabulary_entries'),
      count('kanji_entries'),
      count('grammar_points'),
      admin.from('user_daily_activity')
        .select('user_id,activity_date,study_seconds,lessons_completed,quizzes_completed')
        .gte('activity_date', weekStart)
        .order('activity_date', { ascending: true }),
      admin.from('payments')
        .select('amount_minor,refunded_amount_minor,currency,status,captured_at')
        .in('status', ['captured', 'partially_refunded', 'refunded'])
        .gte('captured_at', monthStart),
      admin.from('profiles').select('id,display_name,created_at').order('created_at', { ascending: false }).limit(6),
      admin.from('payments')
        .select('id,user_id,amount_minor,refunded_amount_minor,currency,status,created_at,captured_at')
        .order('created_at', { ascending: false })
        .limit(6),
      admin.from('contact_messages')
        .select('id,name,email,subject,status,created_at')
        .order('created_at', { ascending: false })
        .limit(6),
      admin.from('subscription_plans')
        .select('id,name,amount_minor,currency,billing_interval,is_active')
        .order('display_order', { ascending: true })
        .limit(6),
    ]);

    for (const result of [dailyActivityResult, monthlyPaymentsResult, recentUsersResult, recentPaymentsResult, recentMessagesResult, plansResult]) {
      if (result.error) throw result.error;
    }

    const activityRows = dailyActivityResult.data ?? [];
    const activityByDate = new Map<string, { learners: Set<string>; studySeconds: number; lessons: number; quizzes: number }>();
    for (const row of activityRows) {
      const key = String(row.activity_date);
      const day = activityByDate.get(key) ?? { learners: new Set<string>(), studySeconds: 0, lessons: 0, quizzes: 0 };
      day.learners.add(String(row.user_id));
      day.studySeconds += Number(row.study_seconds ?? 0);
      day.lessons += Number(row.lessons_completed ?? 0);
      day.quizzes += Number(row.quizzes_completed ?? 0);
      activityByDate.set(key, day);
    }

    const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6 + index));
      const key = isoDate(date);
      const day = activityByDate.get(key);
      return {
        date: key,
        label: date.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
        activeLearners: day?.learners.size ?? 0,
        studyMinutes: Math.round((day?.studySeconds ?? 0) / 60),
        lessonsCompleted: day?.lessons ?? 0,
        quizzesCompleted: day?.quizzes ?? 0,
      };
    });

    const paymentRows = monthlyPaymentsResult.data ?? [];
    const monthlyGrossMinor = paymentRows.reduce((sum, row) => sum + Number(row.amount_minor ?? 0), 0);
    const monthlyRefundedMinor = paymentRows.reduce((sum, row) => sum + Number(row.refunded_amount_minor ?? 0), 0);
    const distinctActiveLearners = new Set(activityRows.map((row) => String(row.user_id))).size;
    const recentUsers = recentUsersResult.data ?? [];
    const users = await Promise.all(recentUsers.map(async (row) => {
      const { data: authResult } = await admin.auth.admin.getUserById(String(row.id));
      return {
        id: row.id,
        name: row.display_name || 'Learner',
        email: authResult.user?.email ?? '—',
        createdAt: row.created_at,
      };
    }));

    const recentPaymentUsers = Array.from(new Set((recentPaymentsResult.data ?? []).map((row) => row.user_id).filter(Boolean)));
    const paymentEmails = new Map<string, string>();
    await Promise.all(recentPaymentUsers.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(String(id));
      if (data.user?.email) paymentEmails.set(String(id), data.user.email);
    }));
    const recentPayments = (recentPaymentsResult.data ?? []).map((row) => ({
      id: row.id,
      email: row.user_id ? paymentEmails.get(String(row.user_id)) ?? '—' : 'Deleted account',
      amountMinor: Number(row.amount_minor ?? 0),
      refundedMinor: Number(row.refunded_amount_minor ?? 0),
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      generatedAt: now.toISOString(),
      metrics: {
        usersTotal,
        newUsersThisMonth: newUsers,
        activeLearnersSevenDays: distinctActiveLearners,
        subscriptionsActive,
        monthlyGrossMinor,
        monthlyRefundedMinor,
        monthlyNetMinor: monthlyGrossMinor - monthlyRefundedMinor,
        openMessages,
        openTickets,
      },
      content: { courses, lessons, vocabulary, kanji, grammar },
      weeklyActivity,
      recentUsers: users,
      recentPayments,
      recentMessages: recentMessagesResult.data ?? [],
      plans: plansResult.data ?? [],
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
