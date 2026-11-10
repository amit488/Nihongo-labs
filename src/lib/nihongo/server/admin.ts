import 'server-only';

import { HttpError } from '@/lib/nihongo/server/http';
import { requireUser } from '@/lib/nihongo/server/supabase';

export const ADMIN_ROLES = ['super_admin', 'admin'] as const;
export const STAFF_ROLES = ['super_admin', 'admin', 'content_editor', 'support_agent'] as const;

export async function requireAdmin(allowedRoles: readonly string[] = ADMIN_ROLES) {
  const context = await requireUser();
  if (!context.ok) {
    return { ok: false as const, status: 401, user: null, roles: [], error: context.error };
  }

  const { data, error } = await context.supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', context.user.id);

  if (error) {
    return {
      ok: false as const,
      status: 500,
      user: context.user,
      roles: [],
      error: 'Could not verify administrator permissions.',
    };
  }

  const roles = (data ?? []).map((row) => String(row.role));
  if (!roles.some((role) => allowedRoles.includes(role))) {
    return {
      ok: false as const,
      status: 403,
      user: context.user,
      roles,
      error: 'Administrator access required.',
    };
  }

  return { ok: true as const, supabase: context.supabase, user: context.user, roles, error: null };
}

export async function requireAdminApi(allowedRoles: readonly string[] = ADMIN_ROLES) {
  const context = await requireAdmin(allowedRoles);
  if (!context.ok) throw new HttpError(context.status, context.error);
  return context;
}
