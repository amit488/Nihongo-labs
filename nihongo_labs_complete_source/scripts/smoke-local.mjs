const base = process.env.NIHONGO_BASE_URL || 'http://localhost:3000';
const checks = [
  ['health', '/api/health', [200]],
  ['grammar content', '/api/learning/content?kind=grammar&level=N5&limit=3', [200]],
  ['vocabulary content', '/api/learning/content?kind=vocabulary&level=N5&limit=3', [200]],
  ['kanji content', '/api/learning/content?kind=kanji&level=N5&limit=3', [200]],
  ['reading content', '/api/learning/content?kind=reading&level=N5&limit=3', [200]],
  ['subscription plans', '/api/billing/plans', [200]],
  ['protected dashboard rejects guest', '/api/learning/dashboard', [401]],
  ['protected practice rejects guest', '/api/practice/attempts', [401]],
];
let failed = 0;
for (const [name, path, accepted] of checks) {
  try {
    const response = await fetch(new URL(path, base), { redirect: 'manual' });
    const ok = accepted.includes(response.status);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: HTTP ${response.status}`);
    if (!ok) failed += 1;
  } catch (error) {
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    failed += 1;
  }
}
if (failed) process.exitCode = 1;
else console.log('All local smoke checks passed.');
