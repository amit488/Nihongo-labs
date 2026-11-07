import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const supabaseUrl = new URL(process.env.SUPABASE_URL || 'http://127.0.0.1:54321');
const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

if (supabaseUrl.protocol !== 'http:' || !allowedHosts.has(supabaseUrl.hostname)) {
  throw new Error('Safety stop: test users may only be provisioned against local Supabase.');
}

const adminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!adminKey) {
  throw new Error('Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY from the local Supabase status output.');
}

const count = Number.parseInt(process.env.LOAD_TEST_USER_COUNT || '1000', 10);
if (!Number.isInteger(count) || count < 1 || count > 5000) {
  throw new Error('LOAD_TEST_USER_COUNT must be an integer between 1 and 5000.');
}

const outputPath = resolve(
  process.env.LOAD_USERS_FILE || 'scripts/load-testing/load-users.local.json',
);
const apiBase = supabaseUrl.toString().replace(/\/+$/, '');
const runId = randomBytes(5).toString('hex');
const users = [];

async function saveManifest() {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(users, null, 2) + '\n', { mode: 0o600 });
}

async function createUser(index) {
  const email = 'loadtest-' + runId + '-' + String(index + 1).padStart(4, '0') + '@example.test';
  const password = randomBytes(24).toString('base64url');
  const response = await fetch(apiBase + '/auth/v1/admin/users', {
    method: 'POST',
    headers: {
      apikey: adminKey,
      Authorization: 'Bearer ' + adminKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'Load Test ' + (index + 1) },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error('Could not create ' + email + ': HTTP ' + response.status + ' ' + (body.msg || body.message || body.error || ''));
  }

  const user = body.user || body;
  if (!user.id) throw new Error('Admin API did not return a user ID for ' + email + '.');

  users.push({ id: user.id, email, password });
  await saveManifest();
}

async function runWithConcurrency(items, concurrency, task) {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await task(items[index], index);
    }
  });
  await Promise.all(workers);
}

console.log('Creating ' + count + ' confirmed test users on local Supabase...');
console.log('No email is sent: users are created through the local Auth admin API.');

try {
  await runWithConcurrency(Array.from({ length: count }, (_, index) => index), 5, async (_item, index) => {
    await createUser(index);
    if ((index + 1) % 100 === 0 || index + 1 === count) {
      console.log('Created ' + (index + 1) + '/' + count);
    }
  });
  console.log('Saved ' + users.length + ' test accounts to ' + outputPath);
  console.log('Run the k6 test, then run cleanup-users.mjs to delete these accounts.');
} catch (error) {
  await saveManifest();
  console.error('Provisioning stopped after ' + users.length + ' successful account(s).');
  console.error('The partial manifest was saved to ' + outputPath + ' so those accounts can be cleaned up.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
