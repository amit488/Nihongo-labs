import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyCheckoutSignature, verifyWebhookSignature, unixToIso } from '../src/lib/nihongo/server/services/razorpay';

process.env.RAZORPAY_KEY_SECRET = 'local-test-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'local-webhook-secret';

test('checkout HMAC accepts only the exact order/payment pair', () => {
  const orderId = 'order_test_12345';
  const paymentId = 'pay_test_12345';
  const signature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!).update(`${orderId}|${paymentId}`).digest('hex');
  assert.equal(verifyCheckoutSignature(orderId, paymentId, signature), true);
  assert.equal(verifyCheckoutSignature(orderId, 'pay_other_12345', signature), false);
});

test('webhook HMAC verifies the raw request body', () => {
  const raw = '{"event":"payment.captured","payload":{}}';
  const signature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest('hex');
  assert.equal(verifyWebhookSignature(raw, signature), true);
  assert.equal(verifyWebhookSignature(`${raw} `, signature), false);
});

test('unixToIso rejects absent or invalid provider timestamps', () => {
  assert.equal(unixToIso(0), null);
  assert.equal(unixToIso('not-a-time'), null);
  assert.equal(unixToIso(1793900000), new Date(1793900000 * 1000).toISOString());
});
