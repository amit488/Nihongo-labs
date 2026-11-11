'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOutAction } from '@/app/actions/auth';
import styles from './admin.module.css';

const navigation = [
  { href: '/admin', label: 'Overview', icon: '◫', exact: true },
  { href: '/admin/users', label: 'Learners', icon: '◉' },
  { href: '/admin/payments', label: 'Payments', icon: '₹' },
  { href: '/admin/inbox', label: 'Inbox', icon: '✉' },
  { href: '/admin/analytics', label: 'Learning analytics', icon: '⌁' },
];

export default function AdminShell({ children, email, roles }: {
  children: React.ReactNode;
  email: string;
  roles: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const initials = email.split('@')[0].slice(0, 2).toUpperCase();

  async function signOut() {
    setSigningOut(true);
    const result = await signOutAction();
    if (result.success) {
      window.dispatchEvent(new Event('nihongo:auth-signed-out'));
      router.replace('/login');
    }
    else setSigningOut(false);
  }

  return (
    <div className={styles.adminFrame}>
      <aside className={styles.sidebar}>
        <Link href="/admin" className={styles.brand}>
          <span className={styles.brandMark}>日</span>
          <span><strong>Nihongo Labs</strong><small>ADMIN CONSOLE</small></span>
        </Link>
        <div className={styles.navCaption}>WORKSPACE</div>
        <nav className={styles.nav} aria-label="Admin navigation">
          {navigation.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={active ? styles.navActive : styles.navLink} aria-current={active ? 'page' : undefined}>
              <span className={styles.navIcon}>{item.icon}</span><span>{item.label}</span>
            </Link>;
          })}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.roleCard}><span className={styles.roleDot} /><div><strong>{roles.includes('super_admin') ? 'Super administrator' : 'Administrator'}</strong><small>Verified staff access</small></div></div>
          <Link href="/learn" className={styles.workspaceLink}>← Back to learning workspace</Link>
          <button type="button" className={styles.signOut} onClick={() => void signOut()} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div><span className={styles.topKicker}>NIHONGO LABS / OPERATIONS</span><strong>Administration</strong></div>
          <div className={styles.account}><span className={styles.avatar}>{initials}</span><span><strong>{email}</strong><small>{roles.join(' · ')}</small></span></div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
