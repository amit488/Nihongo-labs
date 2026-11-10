import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { requireAdmin } from '@/lib/nihongo/server/admin';
import AdminShell from '@/components/nihongo/admin/admin-shell';
import styles from '@/components/nihongo/admin/admin.module.css';

async function AuthorizedAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const context = await requireAdmin();
  if (!context.ok) {
    if (context.status === 401) redirect('/login?next=%2Fadmin');
    redirect('/learn');
  }

  return (
    <AdminShell email={context.user.email ?? 'Administrator'} roles={context.roles}>
      {children}
    </AdminShell>
  );
}

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<div className={styles.loading} role="status"><span />Checking administrator access…</div>}>
      <AuthorizedAdminLayout>{children}</AuthorizedAdminLayout>
    </Suspense>
  );
}
