import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dashboard = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-app.tsx'), 'utf8');
const globalCss = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
const layout = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');
const copyProtection = readFileSync(resolve(process.cwd(), 'src/components/copy-protection.tsx'), 'utf8');

test('daily-goal ring and progress use measured study seconds', () => {
  assert.match(dashboard, /rawStudiedSeconds/);
  assert.match(dashboard, /studiedSeconds\s*\/\s*\(goal\s*\*\s*60\)/);
  assert.match(dashboard, /conic-gradient\(#c7695e 0 \$\{goalPercent\}%/);
  assert.match(dashboard, /aria-label=\{\`\$\{goalPercent\}% of the daily study goal completed\`\}/);
});

test('copy restrictions are mounted globally and preserve editable fields', () => {
  assert.match(globalCss, /body, body \*\s*\{[\s\S]*?user-select:\s*none/);
  assert.match(globalCss, /input, textarea, select, \[contenteditable="true"\][^{]*\{[\s\S]*?user-select:\s*text/);
  assert.match(layout, /<CopyProtection \/>/);
  assert.match(copyProtection, /addEventListener\('copy'/);
  assert.match(copyProtection, /addEventListener\('cut'/);
  assert.match(copyProtection, /event\.preventDefault\(\)/);
  assert.match(copyProtection, /target\.closest\(editableSelector\)/);
});

test('heartbeat retries retain an immutable eight-day batch and preserve newer queued time on expiry', () => {
  const activityApi = readFileSync(resolve(process.cwd(), 'src/app/api/learning/activity/route.ts'), 'utf8');
  assert.match(dashboard, /requestCreatedAt/);
  assert.match(dashboard, /requestSeconds/);
  assert.match(dashboard, /body: JSON\.stringify\(\{ seconds: requestedSeconds, requestId, requestCreatedAt \}\)/);
  assert.match(dashboard, /HEARTBEAT_REQUEST_EXPIRED/);
  assert.match(dashboard, /expiredBatchMilliseconds/);
  assert.match(dashboard, /milliseconds: current\.milliseconds - expiredBatchMilliseconds/);
  assert.match(activityApi, /requestCreatedAt: z\.string\(\)\.datetime/);
  assert.match(activityApi, /_request_created_at: requestCreatedAt/);
  assert.match(activityApi, /HEARTBEAT_REQUEST_EXPIRED/);
});
