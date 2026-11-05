export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function normalizeString(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

function stable(value: unknown): string {
  if (typeof value === 'string') return `s:${normalizeString(value)}`;
  if (typeof value === 'number') return `n:${value}`;
  if (typeof value === 'boolean') return `b:${value}`;
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join('|')}]`;
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    return `{${keys.map((key) => `${key}:${stable(object[key])}`).join('|')}}`;
  }
  return String(value);
}

function unwrapExpected(answerKey: unknown): { expected: unknown[]; ordered: boolean } {
  if (answerKey && typeof answerKey === 'object' && !Array.isArray(answerKey)) {
    const key = answerKey as Record<string, unknown>;
    if (Array.isArray(key.accepted)) return { expected: key.accepted, ordered: key.ordered !== false };
    for (const field of ['option_key', 'value', 'answer', 'sequence', 'pairs']) {
      if (field in key) return { expected: [key[field]], ordered: key.ordered !== false };
    }
  }
  return { expected: [answerKey], ordered: true };
}

/** Supports scalar, accepted-alternative, option-key, ordering and matching answer keys. */
export function gradeAnswer(response: unknown, answerKey: unknown): boolean {
  const { expected, ordered } = unwrapExpected(answerKey);
  if (expected.length === 1) {
    const singleExpected = expected[0];
    if (Array.isArray(response) && Array.isArray(singleExpected)) {
      const left = response.map(stable);
      const right = singleExpected.map(stable);
      if (!ordered) { left.sort(); right.sort(); }
      return left.length === right.length && left.every((value, index) => value === right[index]);
    }
    return stable(response) === stable(singleExpected);
  }
  if (!Array.isArray(response)) return expected.some((value) => stable(response) === stable(value));
  const left = response.map(stable);
  const right = expected.map(stable);
  if (!ordered) {
    left.sort(); right.sort();
  }
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function answerForLearner(answerKey: unknown): unknown {
  const { expected } = unwrapExpected(answerKey);
  return expected.length === 1 ? expected[0] : expected;
}

export function explanationText(explanation: unknown): string {
  if (typeof explanation === 'string') return explanation;
  if (explanation && typeof explanation === 'object') {
    const value = explanation as Record<string, unknown>;
    return String(value.explanation ?? value.text ?? value.why ?? value.detail ?? 'Review the grammar rule and example sentence.');
  }
  return 'Review the grammar rule and example sentence.';
}
