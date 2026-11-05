export function localDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

export function consecutiveStreak(dateKeys: string[], todayKey: string): number {
  const active = new Set(dateKeys);
  const today = new Date(`${todayKey}T00:00:00.000Z`);
  const cursor = new Date(today);
  if (!active.has(todayKey)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (active.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function addInterval(start: Date, interval: 'month' | 'year' | 'lifetime', count = 1): Date | null {
  if (interval === 'lifetime') return null;
  const result = new Date(start);
  if (interval === 'month') result.setUTCMonth(result.getUTCMonth() + count);
  else result.setUTCFullYear(result.getUTCFullYear() + count);
  return result;
}
