'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import styles from './admin.module.css';

type Section = 'overview' | 'users' | 'payments' | 'inbox' | 'analytics' | 'database';
type ActivityDay = {
  date: string;
  label: string;
  activeLearners: number;
  studyMinutes: number;
  lessonsCompleted: number;
  quizzesCompleted: number;
};
type AdminMetrics = {
  usersTotal: number;
  newUsersThisMonth: number;
  activeLearnersSevenDays: number;
  subscriptionsActive: number;
  monthlyGrossMinor: number;
  monthlyRefundedMinor: number;
  monthlyNetMinor: number;
  openMessages: number;
  openTickets: number;
};
type LearnerRow = {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  joinedAt?: string;
  lastSignInAt?: string | null;
  emailConfirmed?: boolean;
  roles?: string[];
  plan?: string;
  subscriptionStatus?: string;
};
type PaymentRow = {
  id: string;
  email: string;
  amountMinor: number;
  refundedMinor: number;
  currency: string;
  status: string;
  createdAt: string;
  provider?: string;
  providerPaymentId?: string | null;
};
type ContactRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  created_at: string;
};
type TicketRow = {
  id: string;
  subject: string;
  requester_email: string | null;
  priority: string;
  status: string;
  created_at: string;
};
type DatabaseTable = { schema: string; name: string; estimated_rows: number; total_bytes: number; data_bytes: number; index_bytes: number };
type DatabaseHealth = { database_name: string; database_size_bytes: number; storage_limit_bytes: number | null; storage_limit_source: string; table_count: number; empty_table_count: number; populated_table_count: number; estimated_row_count: number; tables: DatabaseTable[]; generated_at: string };
type AdminData = {
  generatedAt?: string;
  database?: DatabaseHealth;
  metrics?: AdminMetrics;
  content?: Record<string, number>;
  weeklyActivity?: ActivityDay[];
  recentUsers?: LearnerRow[];
  recentPayments?: PaymentRow[];
  recentMessages?: ContactRow[];
  plans?: Array<{ id: string; name: string; amount_minor: number; currency: string; billing_interval: string; is_active: boolean }>;
  users?: LearnerRow[];
  payments?: PaymentRow[];
  contacts?: ContactRow[];
  tickets?: TicketRow[];
  page?: number;
  perPage?: number;
  total?: number;
  hasMore?: boolean;
  searchLimitedToFirstThousand?: boolean;
  error?: string;
};
const headings: Record<Section, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: 'BUSINESS OVERVIEW', title: 'Good to see you.', description: 'A live view of Nihongo Labs operations, learners and revenue.' },
  users: { eyebrow: 'LEARNER DIRECTORY', title: 'Your learners', description: 'Find registered learners and review their account and subscription details.' },
  payments: { eyebrow: 'FINANCIAL OPERATIONS', title: 'Payments', description: 'Review captured transactions, refunds and payment status from your billing ledger.' },
  inbox: { eyebrow: 'CUSTOMER EXPERIENCE', title: 'Contact & support inbox', description: 'Review suggestions, complaints and support requests from your learners.' },
  analytics: { eyebrow: 'LEARNING INTELLIGENCE', title: 'Learning analytics', description: 'Understand how learners engage with Nihongo Labs and its study tools.' },
  database: { eyebrow: 'DATABASE OPERATIONS', title: 'Database health', description: 'Monitor storage consumption, table inventory and the largest data tables.' },
};

function money(minor: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format((Number(minor) || 0) / 100);
}
function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}
function dateLabel(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function timeLabel(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function Status({ value }: { value: string }) {
  const state = value.toLowerCase().replace(/[^a-z]/g, '');
  return <span className={`${styles.status} ${styles[`status_${state}`] ?? ''}`}>{value.replaceAll('_', ' ')}</span>;
}
function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: string }) {
  return <article className={styles.metric}><div className={styles.metricTop}><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{note}</small></article>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

export default function AdminWorkspace({ section }: { section: Section }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [updatingId, setUpdatingId] = useState('');
  const heading = headings[section];
  const users = data?.users ?? [];
  const payments = section === 'payments' ? data?.payments ?? [] : data?.recentPayments ?? [];
  const messages = data?.contacts ?? [];

  const load = useCallback(async (term = '', requestedPage = 1) => {
    await Promise.resolve();
    setLoading(true);
    setError('');
    try {
      const endpoint = section === 'overview' || section === 'analytics'
        ? '/api/admin/overview'
        : section === 'database'
          ? '/api/admin/database'
          : section === 'users'
          ? '/api/admin/users?page=' + requestedPage + '&perPage=25' + (term ? '&q=' + encodeURIComponent(term) : '')
          : section === 'payments'
            ? '/api/admin/payments'
            : '/api/admin/messages';
      const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' });
      const body = await response.json() as AdminData;
      if (!response.ok) throw new Error(body.error || 'Could not load administrator data.');
      setData(section === 'database' ? { database: body as unknown as DatabaseHealth, generatedAt: (body as unknown as DatabaseHealth).generated_at } : body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load administrator data.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function searchUsers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(query.trim());
    setUserPage(1);
    await load(query.trim(), 1);
  }

  async function updateMessage(id: string, kind: 'contact' | 'ticket', status: string) {
    setUpdatingId(id);
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, kind, status }),
      });
      const body = await response.json() as AdminData;
      if (!response.ok) throw new Error(body.error || 'Could not update inbox item.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update inbox item.');
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.pageHeading}>
        <div><div className={styles.eyebrow}>{heading.eyebrow}</div><h1>{heading.title}</h1><p>{heading.description}</p></div>
        <div className={styles.headingMeta}><span className={styles.liveDot} /> Connected to Supabase <small>{data?.generatedAt ? 'Updated ' + timeLabel(data.generatedAt) : 'Live data'}</small></div>
      </div>
      {error ? <div className={styles.error} role="alert">{error}<button type="button" onClick={() => void load(search, userPage)}>Retry</button></div> : null}
      {loading && !data ? <div className={styles.loading}><span />Loading live administrator data…</div> : null}

      {section === 'database' && data?.database ? <>
        <div className={styles.metricGrid}>
          <Metric label="Database storage used" value={formatBytes(data.database.database_size_bytes)} note={data.database.storage_limit_bytes ? `${formatBytes(data.database.storage_limit_bytes - data.database.database_size_bytes)} remaining of ${formatBytes(data.database.storage_limit_bytes)} configured` : 'Live PostgreSQL database size'} icon="▤" />
          <Metric label="Total tables" value={data.database.table_count.toLocaleString('en-IN')} note={`${data.database.populated_table_count} with estimated rows`} icon="▦" />
          <Metric label="Empty tables" value={data.database.empty_table_count.toLocaleString('en-IN')} note="No live rows in PostgreSQL statistics" icon="○" />
          <Metric label="Estimated rows" value={data.database.estimated_row_count.toLocaleString('en-IN')} note="PostgreSQL statistics estimate; not an exact count" icon="#" />
        </div>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><span className={styles.eyebrow}>STORAGE OVERVIEW</span><h2>{data.database.database_name}</h2></div><span className={styles.panelMeta}>Updated {timeLabel(data.database.generated_at)}</span></div>
          {data.database.storage_limit_bytes ? <div className={styles.storageTrack}><span style={{ width: `${Math.min(100, data.database.database_size_bytes / data.database.storage_limit_bytes * 100)}%` }} /></div> : <p className={styles.panelFoot}>Project storage quota is not exposed by PostgreSQL. Set SUPABASE_DATABASE_STORAGE_LIMIT_BYTES to your plan’s database limit to show capacity and utilization here.</p>}
          {data.database.storage_limit_bytes ? <div className={styles.storageLegend}><span>{formatBytes(data.database.database_size_bytes)} used</span><strong>{(data.database.database_size_bytes / data.database.storage_limit_bytes * 100).toFixed(1)}% of configured limit</strong><span>{formatBytes(Math.max(0, data.database.storage_limit_bytes - data.database.database_size_bytes))} available</span></div> : null}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><span className={styles.eyebrow}>TABLE INVENTORY</span><h2>Tables ranked by estimated row count</h2></div><span className={styles.panelMeta}>{data.database.tables.length} public tables</span></div>
          {data.database.tables.length ? <div className={styles.tableWrap}><table><thead><tr><th>Table</th><th>Estimated rows</th><th>Total size</th><th>Table data</th><th>Indexes</th><th>State</th></tr></thead><tbody>{data.database.tables.map((table) => <tr key={table.schema + '.' + table.name}><td><strong>{table.name}</strong><small>{table.schema}</small></td><td>{Number(table.estimated_rows).toLocaleString('en-IN')}</td><td>{formatBytes(table.total_bytes)}</td><td>{formatBytes(table.data_bytes)}</td><td>{formatBytes(table.index_bytes)}</td><td><Status value={table.estimated_rows > 0 ? 'Populated' : 'Empty (estimated)'}/></td></tr>)}</tbody></table></div> : <Empty>No public tables were found.</Empty>}
          <p className={styles.panelFoot}>Largest table by estimated row count: <strong>{data.database.tables[0]?.name ?? '—'}</strong>{data.database.tables[0] ? ` · ${Number(data.database.tables[0].estimated_rows).toLocaleString('en-IN')} estimated rows · ${formatBytes(data.database.tables[0].total_bytes)} total size` : ''}. Row counts are PostgreSQL planner statistics, so they are estimates and may lag until ANALYZE runs.</p>
        </section>
      </> : null}

      {(section === 'overview' || section === 'analytics') && data ? <>
        <div className={styles.metricGrid}>
          <Metric label="Registered learners" value={Number(data.metrics?.usersTotal ?? 0).toLocaleString('en-IN')} note={`+${data.metrics?.newUsersThisMonth ?? 0} this month`} icon="◉" />
          <Metric label="Active learners · 7 days" value={Number(data.metrics?.activeLearnersSevenDays ?? 0).toLocaleString('en-IN')} note="Learners with recorded study activity" icon="⌁" />
          <Metric label="Active subscriptions" value={Number(data.metrics?.subscriptionsActive ?? 0).toLocaleString('en-IN')} note="Active and trial subscriptions" icon="◇" />
          <Metric label="Net collected · month" value={money(data.metrics?.monthlyNetMinor ?? 0)} note={`Gross ${money(data.metrics?.monthlyGrossMinor ?? 0)} · refunds ${money(data.metrics?.monthlyRefundedMinor ?? 0)}`} icon="₹" />
          <Metric label="New contact messages" value={Number(data.metrics?.openMessages ?? 0).toLocaleString('en-IN')} note="Waiting for a first review" icon="✉" />
          <Metric label="Open support tickets" value={Number(data.metrics?.openTickets ?? 0).toLocaleString('en-IN')} note="Open, in progress or waiting" icon="?" />
        </div>
        {section === 'overview' ? <div className={styles.overviewGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><span className={styles.eyebrow}>LAST SEVEN DAYS</span><h2>Learning activity</h2></div><span className={styles.panelMeta}>Recorded study time</span></div>
            <div className={styles.chart}>
              {(data.weeklyActivity ?? []).map((day) => <div className={styles.chartColumn} key={day.date}>
                <div className={styles.barTrack}><span style={{ height: `${Math.max(3, Math.min(100, Number(day.studyMinutes) / Math.max(30, ...(data.weeklyActivity ?? []).map((row) => Number(row.studyMinutes))) * 100))}%` }} /></div>
                <small>{day.label}</small><b>{day.studyMinutes}m</b>
              </div>)}
            </div>
            <div className={styles.chartFooter}><span>Daily active learners</span><strong>{(data.weeklyActivity ?? []).reduce((sum, day) => sum + Number(day.activeLearners ?? 0), 0).toLocaleString('en-IN')} learner-days</strong></div>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><span className={styles.eyebrow}>CONTENT LIBRARY</span><h2>Learning content records</h2></div></div>
            <div className={styles.inventory}>
              {Object.entries(data.content ?? {}).map(([label, value]) => <div key={label}><span>{label}</span><strong>{Number(value).toLocaleString('en-IN')}</strong></div>)}
            </div>
            <p className={styles.panelFoot}>Counts reflect records currently stored in the learning database.</p>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><span className={styles.eyebrow}>RECENT SIGNUPS</span><h2>New learners</h2></div><Link href="/admin/users">View all →</Link></div>
            {(data.recentUsers ?? []).length ? <div className={styles.rowList}>{data.recentUsers?.map((user) => <div className={styles.userRow} key={user.id}><span className={styles.personMark}>{String(user.name || 'L').slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><time>{dateLabel(user.createdAt)}</time></div>)}</div> : <Empty>No registered learners yet.</Empty>}
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><span className={styles.eyebrow}>BILLING ACTIVITY</span><h2>Recent payments</h2></div><Link href="/admin/payments">View all →</Link></div>
            {(data.recentPayments ?? []).length ? <div className={styles.rowList}>{data.recentPayments?.map((payment) => <div className={styles.paymentRow} key={payment.id}><div><strong>{payment.email}</strong><small>{timeLabel(payment.createdAt)}</small></div><div><strong>{money(payment.amountMinor, payment.currency)}</strong><Status value={payment.status}/></div></div>)}</div> : <Empty>No payments recorded yet.</Empty>}
          </section>
        </div> : <section className={styles.panel}>
          <div className={styles.panelHeading}><div><span className={styles.eyebrow}>FEATURE INVENTORY</span><h2>Content and learner activity</h2></div></div>
          <div className={styles.analyticsGrid}>
            <div><strong>{data.metrics?.activeLearnersSevenDays ?? 0}</strong><span>Unique active learners in 7 days</span></div>
            <div><strong>{(data.weeklyActivity ?? []).reduce((sum, day) => sum + Number(day.studyMinutes ?? 0), 0)}</strong><span>Study minutes recorded in 7 days</span></div>
            <div><strong>{(data.weeklyActivity ?? []).reduce((sum, day) => sum + Number(day.lessonsCompleted ?? 0), 0)}</strong><span>Lessons completed in 7 days</span></div>
            <div><strong>{(data.weeklyActivity ?? []).reduce((sum, day) => sum + Number(day.quizzesCompleted ?? 0), 0)}</strong><span>Quizzes completed in 7 days</span></div>
          </div>
          <div className={styles.panelFoot}>Activity is based on persisted user_daily_activity rows. Empty periods are shown as zero; no sample metrics are fabricated.</div>
        </section>}
      </> : null}

      {section === 'users' && data ? <section className={styles.panel}>
        <div className={styles.panelHeading}><div><span className={styles.eyebrow}>ACCOUNT DIRECTORY</span><h2>{data.total ?? users.length} learners found</h2></div>
          <form className={styles.searchForm} onSubmit={searchUsers}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" aria-label="Search learners"/><button type="submit">Search</button></form>
        </div>
        {search ? <p className={styles.filterNote}>Search results for “{search}”. Search is limited to the first 1,000 Auth records.</p> : null}
        {users.length ? <><div className={styles.tableWrap}><table><thead><tr><th>Learner</th><th>Joined</th><th>Plan</th><th>Subscription</th><th>Last sign in</th><th>Access</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td>{dateLabel(user.joinedAt)}</td><td>{user.plan}</td><td><Status value={user.subscriptionStatus ?? 'free'}/></td><td>{timeLabel(user.lastSignInAt)}</td><td>{user.roles?.length ? user.roles.join(', ') : 'Learner'}</td></tr>)}</tbody></table></div>{!search ? <div className={styles.pagination}><span>Page {data.page} · showing {users.length} of {data.total}</span><div><button type="button" disabled={userPage <= 1 || loading} onClick={() => { const next = userPage - 1; setUserPage(next); void load('', next); }}>Previous</button><button type="button" disabled={!data.hasMore || loading} onClick={() => { const next = userPage + 1; setUserPage(next); void load('', next); }}>Next</button></div></div> : null}</> : <Empty>No learners match this search.</Empty>}
      </section> : null}

      {section === 'payments' && data ? <section className={styles.panel}>
        <div className={styles.panelHeading}><div><span className={styles.eyebrow}>PAYMENT LEDGER</span><h2>Latest transactions</h2></div><span className={styles.panelMeta}>Most recent 100 records</span></div>
        {payments.length ? <div className={styles.tableWrap}><table><thead><tr><th>Transaction</th><th>Learner</th><th>Provider</th><th>Amount</th><th>Refunded</th><th>Status</th><th>Date</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><strong>{String(payment.id).slice(0, 8)}…</strong><small>{payment.providerPaymentId || payment.provider}</small></td><td>{payment.email}</td><td>{payment.provider}</td><td>{money(payment.amountMinor, payment.currency)}</td><td>{money(payment.refundedMinor, payment.currency)}</td><td><Status value={payment.status}/></td><td>{dateLabel(payment.createdAt)}</td></tr>)}</tbody></table></div> : <Empty>No payment records yet. Transactions will appear here after the billing provider confirms them.</Empty>}
      </section> : null}

      {section === 'inbox' && data ? <div className={styles.inboxGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><span className={styles.eyebrow}>CONTACT FORM</span><h2>Suggestions and complaints</h2></div><span className={styles.panelMeta}>{messages.filter((message) => message.status === 'new').length} new</span></div>
          {messages.length ? <div className={styles.messageList}>{messages.map((message) => <article className={styles.message} key={message.id}><div className={styles.messageTop}><div><strong>{message.name}</strong><small>{message.email} · {timeLabel(message.created_at)}</small></div><Status value={message.status}/></div><div className={styles.messageSubject}>{message.subject || 'General enquiry'}</div><p>{message.message}</p><div className={styles.messageActions}>{message.status === 'new' ? <button type="button" disabled={updatingId === message.id} onClick={() => void updateMessage(message.id, 'contact', 'read')}>Mark as read</button> : null}{message.status !== 'closed' ? <button type="button" className={styles.secondaryAction} disabled={updatingId === message.id} onClick={() => void updateMessage(message.id, 'contact', 'closed')}>Close conversation</button> : null}</div></article>)}</div> : <Empty>Your inbox is clear. New contact submissions will appear here.</Empty>}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><span className={styles.eyebrow}>SUPPORT QUEUE</span><h2>Support tickets</h2></div></div>
          {(data.tickets ?? []).length ? <div className={styles.rowList}>{data.tickets?.map((ticket) => <div className={styles.ticket} key={ticket.id}><div><strong>{ticket.subject}</strong><small>{ticket.requester_email || 'Registered learner'} · {dateLabel(ticket.created_at)}</small></div><div><Status value={ticket.priority}/><Status value={ticket.status}/></div></div>)}</div> : <Empty>No support tickets have been created.</Empty>}
        </section>
      </div> : null}
    </div>
  );
}
