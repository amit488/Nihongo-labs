import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const supabaseUrl = new URL(process.env.SUPABASE_URL || 'http://127.0.0.1:54321');
const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

if (supabaseUrl.protocol !== 'http:' || !allowedHosts.has(supabaseUrl.hostname)) {
  throw new Error('Safety stop: cleanup may only target local Supabase.');
}

const adminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!adminKey) {
  throw new Error('Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY from the local Supabase status output.');
}

const manifestPath = resolve(
  process.env.LOAD_USERS_FILE || 'scripts/load-testing/load-users.local.json',
);
const users = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!Array.isArray(users)) throw new Error('The load-test manifest must contain an array.');

const apiBase = supabaseUrl.toString().replace(/\/+$/, '');
let failed = 0;

for (let offset = 0; offset < users.length; offset += 10) {
  const batch = users.slice(offset, offset + 10);
  const results = await Promise.all(batch.map(async (user) => {
    if (!user || typeof user.id !== 'string') return false;
    const response = await fetch(apiBase + '/auth/v1/admin/users/' + encodeURIComponent(user.id), {
      method: 'DELETE',
      headers: {
        apikey: adminKey,
        Authorization: 'Bearer ' + adminKey,
      },
    });
    if (!response.ok && response.status !== 404) {
      const message = await response.text().catch(() => '');
      console.error('Could not delete ' + (user.email || user.id) + ': HTTP ' + response.status + ' ' + message);
      return false;
    }
    return true;
  }));
  failed += results.filter((ok) => !ok).length;
  console.log('Processed ' + Math.min(offset + batch.length, users.length) + '/' + users.length);
}

if (failed === 0) {
  await rm(manifestPath);
  console.log('Deleted ' + users.length + ' local load-test account(s) and removed the credential manifest.');
} else {
  console.error(failed + ' account(s) could not be deleted. The manifest was retained for another cleanup attempt.');
  process.exitCode = 1;
}
