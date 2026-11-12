import { connection, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/nihongo/server/admin';
import { createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { jsonError } from '@/lib/nihongo/server/http';

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

type DashboardAggregates = {
  weeklyActivity?: Array<{
    date: string;
    activeLearners: number | string;
    lessonsCompleted: number | string;
    quizzesCompleted: number | string;
  }>;
  activeLearnersSevenDays?: number | string;
  monthlyPaymentsByCurrency?: Array<{
    currency: string;
    grossMinor: number | string;
    refundedMinor: number | string;
    netMinor: number | string;
  }>;
};

export async function GET() {
  await connection();
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
      usersTotal, newUsers, subscriptionsActive, openMessages, openTickets,
      courses, lessons, vocabulary, kanji, grammar, aggregatesResult,
      recentUsersResult, recentPaymentsResult, recentMessagesResult, plansResult,
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
      admin.rpc('admin_get_dashboard_aggregates', {
        _week_start: weekStart,
        _month_start: monthStart,
      }),
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

    for (const result of [aggregatesResult, recentUsersResult, recentPaymentsResult, recentMessagesResult, plansResult]) {
      if (result.error) throw result.error;
    }

    const aggregates = (aggregatesResult.data ?? {}) as DashboardAggregates;
    const weeklyActivity = (aggregates.weeklyActivity ?? []).map((day) => ({
      date: day.date,
      label: new Date(`${day.date}T00:00:00.000Z`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
      activeLearners: Number(day.activeLearners ?? 0),
      lessonsCompleted: Number(day.lessonsCompleted ?? 0),
      quizzesCompleted: Number(day.quizzesCompleted ?? 0),
    }));
    const paymentTotals = (aggregates.monthlyPaymentsByCurrency ?? []).map((row) => ({
      currency: row.currency,
      grossMinor: Number(row.grossMinor ?? 0),
      refundedMinor: Number(row.refundedMinor ?? 0),
      netMinor: Number(row.netMinor ?? 0),
    }));
    // Keep the legacy dashboard headline INR-denominated, but never add currencies
    // together. The complete breakdown is also returned for multi-currency review.
    const headlinePayments = paymentTotals.find((row) => row.currency === 'INR');
    const monthlyGrossMinor = headlinePayments?.grossMinor ?? 0;
    const monthlyRefundedMinor = headlinePayments?.refundedMinor ?? 0;

    const recentUsers = recentUsersResult.data ?? [];
    const recentPaymentsRows = recentPaymentsResult.data ?? [];
    const authUserIds = Array.from(new Set([
      ...recentUsers.map((row) => String(row.id)),
      ...recentPaymentsRows.map((row) => row.user_id ? String(row.user_id) : ''),
    ].filter(Boolean)));
    const { data: emailRows, error: emailError } = await admin.rpc('admin_user_emails', {
      _user_ids: authUserIds,
    });
    if (emailError) throw emailError;
    const emails = new Map((emailRows ?? []).map((row: { user_id: string; email: string }) => [row.user_id, row.email]));

    const users = recentUsers.map((row) => ({
      id: row.id,
      name: row.display_name || 'Learner',
      email: emails.get(String(row.id)) ?? '—',
      createdAt: row.created_at,
    }));
    const recentPayments = recentPaymentsRows.map((row) => ({
      id: row.id,
      email: row.user_id ? emails.get(String(row.user_id)) ?? '—' : 'Deleted account',
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
        activeLearnersSevenDays: Number(aggregates.activeLearnersSevenDays ?? 0),
        subscriptionsActive,
        monthlyGrossMinor,
        monthlyRefundedMinor,
        monthlyNetMinor: monthlyGrossMinor - monthlyRefundedMinor,
        monthlyPaymentsByCurrency: paymentTotals,
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
