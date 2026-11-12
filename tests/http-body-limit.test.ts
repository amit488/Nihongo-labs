import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, readBodyText, readJson } from '../src/lib/nihongo/server/http';

test('bounded body reader accepts a body at or below the configured byte limit', async () => {
  const request = new Request('http://localhost/api/test', {
    method: 'POST',
    body: JSON.stringify({ word: '日本語' }),
  });
  const value = await readJson(request, {
    parse(input: unknown) {
      assert.deepEqual(input, { word: '日本語' });
      return input;
    },
  }, 64);
  assert.deepEqual(value, { word: '日本語' });
});

test('bounded body reader rejects oversized streamed bodies before buffering the full payload', async () => {
  const request = new Request('http://localhost/api/test', {
    method: 'POST',
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('123456'));
        controller.enqueue(new TextEncoder().encode('789012'));
        controller.close();
      },
    }),
    duplex: 'half',
  } as RequestInit);
  await assert.rejects(
    readBodyText(request, 8),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
});

test('bounded body reader rejects a declared oversized body without reading it', async () => {
  const request = new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'content-length': '1000' },
    body: 'small',
  });
  await assert.rejects(
    readBodyText(request, 8),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
});
