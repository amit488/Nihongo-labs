const millisecondsPerDay = 86_400_000;

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Returns calendar days until a YYYY-MM-DD event in the learner's timezone. */
export function getDaysUntilJlpt(examDate: string, now: Date = new Date(), timeZone = 'Asia/Kolkata'): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(examDate);
  if (!match) throw new RangeError('Exam date must use YYYY-MM-DD format.');
  const [, yearText, monthText, dayText] = match;
  const examTimestamp = Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText));
  if (new Date(examTimestamp).toISOString().slice(0, 10) !== examDate) {
    throw new RangeError('Exam date is not a valid calendar date.');
  }
  const today = dateParts(now, timeZone);
  const todayTimestamp = Date.UTC(today.year, today.month - 1, today.day);
  return Math.round((examTimestamp - todayTimestamp) / millisecondsPerDay);
}
