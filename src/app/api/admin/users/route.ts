import { connection, NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/nihongo/server/admin';
import { createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { jsonError } from '@/lib/nihongo/server/http';

export async function GET(request: NextRequest) {
  await connection();
  try {
    await requireAdminApi();
    const admin = createAdminSupabase();
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Math.min(10000, Number(params.get('page') ?? 1) || 1));
    const perPage = Math.max(10, Math.min(100, Number(params.get('perPage') ?? 25) || 25));
    const query = (params.get('q') ?? '').trim().toLowerCase();

    const { data, error } = await admin.auth.admin.listUsers({ page: query ? 1 : page, perPage: query ? 1000 : perPage });
    if (error) throw error;
    const authUsers = data.users ?? [];
    const ids = authUsers.map((user) => user.id);
    const { count: totalProfiles, error: totalError } = await admin.from('profiles').select('id', { count: 'exact', head: true });
    if (totalError) throw totalError;
    if (!ids.length) return NextResponse.json({ users: [], page, perPage, total: query ? 0 : totalProfiles ?? 0, hasMore: false });

    const [{ data: profiles, error: profileError }, { data: roles, error: roleError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
      admin.from('profiles').select('id,display_name,created_at,timezone').in('id', ids),
      admin.from('user_roles').select('user_id,role').in('user_id', ids),
      admin.from('subscriptions').select('user_id,status,plan_id,subscription_plans(name)').in('user_id', ids).order('created_at', { ascending: false }),
    ]);
    if (profileError) throw profileError;
    if (roleError) throw roleError;
    if (subscriptionError) throw subscriptionError;

    const profileMap = new Map((profiles ?? []).map((row) => [row.id, row]));
    const roleMap = new Map<string, string[]>();
    for (const row of roles ?? []) roleMap.set(row.user_id, [...(roleMap.get(row.user_id) ?? []), String(row.role)]);
    const subscriptionMap = new Map<string, { status: string; plan: string }>();
    for (const row of subscriptions ?? []) {
      if (!row.user_id || subscriptionMap.has(row.user_id)) continue;
      const planRelation = row.subscription_plans as unknown as { name?: string } | null;
      subscriptionMap.set(row.user_id, { status: String(row.status), plan: planRelation?.name ?? 'Unknown plan' });
    }

    let users = authUsers.map((user) => {
      const profile = profileMap.get(user.id);
      const subscription = subscriptionMap.get(user.id);
      return {
        id: user.id,
        email: user.email ?? '',
        name: profile?.display_name ?? String(user.user_metadata?.display_name ?? 'Learner'),
        joinedAt: profile?.created_at ?? user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        emailConfirmed: Boolean(user.email_confirmed_at),
        roles: roleMap.get(user.id) ?? [],
        plan: subscription?.plan ?? 'Free',
        subscriptionStatus: subscription?.status ?? 'free',
      };
    });

    if (query) {
      users = users.filter((user) => user.email.toLowerCase().includes(query) || user.name.toLowerCase().includes(query));
    }
    const total = query ? users.length : totalProfiles ?? users.length;
    if (query) users = users.slice(0, 100);
    else users = users.slice(0, perPage);
    return NextResponse.json({ users, page, perPage, total, hasMore: query ? false : page * perPage < total, searchLimitedToFirstThousand: Boolean(query) }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return jsonError(error);
  }
}
