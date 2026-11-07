import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// The script is intentionally local-only. Do not point it at production.
const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

function localUrl(value, fallback, label) {
  const parsed = new URL(value || fallback);
  if (parsed.protocol !== 'http:' || !allowedHosts.has(parsed.hostname)) {
    throw new Error(label + ' must use a loopback URL. This harness is local-only.');
  }
  return parsed.toString().replace(/\/+$/, '');
}

const appUrl = localUrl(__ENV.BASE_URL, 'http://127.0.0.1:3000', 'BASE_URL');
const supabaseUrl = localUrl(__ENV.SUPABASE_URL, 'http://127.0.0.1:54321', 'SUPABASE_URL');
const publishableKey = __ENV.SUPABASE_PUBLISHABLE_KEY;
if (!publishableKey) throw new Error('Set SUPABASE_PUBLISHABLE_KEY from the local Supabase status output.');

const usersPath = __ENV.LOAD_USERS_FILE || './scripts/load-testing/load-users.local.json';
const users = JSON.parse(open(usersPath));
if (!Array.isArray(users) || users.length === 0) {
  throw new Error('No test users found in ' + usersPath + '. Run provision-users.mjs first.');
}

const targetVUs = Number.parseInt(__ENV.TARGET_VUS || '1000', 10);
if (!Number.isInteger(targetVUs) || targetVUs < 1 || targetVUs > users.length) {
  throw new Error('TARGET_VUS must be between 1 and the ' + users.length + ' provisioned test users.');
}

const loginSuccess = new Rate('auth_login_success');
const loginDuration = new Trend('auth_login_duration', true);
const loginThrottled = new Counter('auth_login_429');
const loginPageSuccess = new Rate('login_page_success');

function rampTarget(fraction) {
  return Math.max(1, Math.round(targetVUs * fraction));
}

export const options = {
  scenarios: {
    staged_login_wave: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: rampTarget(0.05) },
        { duration: '45s', target: rampTarget(0.20) },
        { duration: '45s', target: rampTarget(0.50) },
        { duration: '45s', target: targetVUs },
        { duration: '30s', target: targetVUs },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '0s',
      gracefulStop: '15s',
    },
  },
  thresholds: {
    auth_login_success: ['rate>0.99'],
    login_page_success: ['rate>0.99'],
    auth_login_duration: ['p(95)<3000', 'p(99)<8000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Ramping VUs are assigned distinct accounts; the 4-minute hold prevents
  // a VU from starting a second login during this staged run.
  const user = users[__VU - 1];
  if (!user) throw new Error('No unique test account assigned to VU ' + __VU + '.');

  const pageResponse = http.get(appUrl + '/login', {
    tags: { step: 'login_page' },
    timeout: '30s',
    redirects: 0,
  });
  const pageOk = check(pageResponse, {
    'login page responds HTTP 200': (response) => response.status === 200,
  });
  loginPageSuccess.add(pageOk);

  const startedAt = Date.now();
  const response = http.post(
    supabaseUrl + '/auth/v1/token?grant_type=password',
    JSON.stringify({ email: user.email, password: user.password }),
    {
      headers: {
        apikey: publishableKey,
        'Content-Type': 'application/json',
      },
      tags: { step: 'password_login' },
      timeout: '30s',
    },
  );
  loginDuration.add(Date.now() - startedAt);

  if (response.status === 429) loginThrottled.add(1);

  let payload = {};
  try {
    payload = response.json();
  } catch {
    // The checks below record a failed login for non-JSON responses.
  }

  const authenticated = check(response, {
    'password login returns HTTP 200': (result) => result.status === 200,
    'password login returns an access token': () =>
      typeof payload.access_token === 'string' && payload.access_token.length > 20,
  });
  loginSuccess.add(authenticated);

  // Keep each VU occupied so it makes exactly one login attempt in this run.
  sleep(240);
}
