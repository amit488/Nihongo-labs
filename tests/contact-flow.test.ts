import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('contact entry points are available on the landing page and signed-in workspace', () => {
  const landing = read('src/app/page.tsx');
  const workspace = read('src/components/nihongo/learning-app.tsx');
  assert.match(landing, /href="\/contact"/);
  const heroActions = landing.match(/<div className="heroActions">([\s\S]*?)<\/div>/)?.[1] ?? '';
  assert.match(heroActions, /Explore the workspace/);
  assert.doesNotMatch(heroActions, /signup|Suggestions \/ complaints/);
  assert.match(workspace, /href="\/contact"/);
  assert.match(workspace, /Contact us/);
  assert.match(workspace, /Send feedback/);
});

test('contact page collects the required details and gives a clear success state', () => {
  const page = read('src/app/contact/page.tsx');
  const form = read('src/components/nihongo/contact-form.tsx');
  assert.match(page, /ContactForm/);
  assert.match(form, /name="name"/);
  assert.match(form, /type="email"/);
  assert.match(form, /name="message"/);
  assert.match(form, /Suggestion/);
  assert.match(form, /Complaint/);
  assert.match(form, /role="status"/);
  assert.match(form, /We use your email only if we need to follow up/);
});

test('contact submissions are validated server-side and use the existing private contact_messages table', () => {
  const route = read('src/app/api/contact/route.ts');
  assert.ok(route.includes('assertSameOrigin(request)'));
  assert.ok(route.includes('createHmac'));
  assert.ok(route.includes("rpc('consume_api_rate_limit'"));
  assert.ok(route.includes('_max_hits: 5'));
  assert.ok(route.includes('_window_seconds: 3600'));
  assert.ok(!route.includes('request.text()'));
  assert.match(route, /contactMessageSchema/);
  assert.ok(route.includes("from('contact_messages')"));
  assert.ok(route.includes('authData.user.id'));
  assert.ok(route.includes('input.website'));
  assert.ok(route.includes('.max(10000)'));
  assert.ok(route.includes('jsonError(error)'));
});
