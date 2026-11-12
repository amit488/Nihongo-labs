import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPaymentCaptureFinal,
  mapRazorpaySubscriptionStatus,
} from '../src/lib/nihongo/server/services/billing-provider-events';

test('known provider subscription states map explicitly', () => {
  assert.equal(mapRazorpaySubscriptionStatus('subscription.updated', 'active'), 'active');
  assert.equal(mapRazorpaySubscriptionStatus('subscription.updated', 'paused'), 'paused');
  assert.equal(mapRazorpaySubscriptionStatus('subscription.updated', 'halted'), 'unpaid');
  assert.equal(mapRazorpaySubscriptionStatus('subscription.updated', 'cancelled'), 'canceled');
  assert.equal(mapRazorpaySubscriptionStatus('subscription.updated', 'completed'), 'expired');
  assert.equal(mapRazorpaySubscriptionStatus('subscription.activated', ''), 'active');
  assert.equal(mapRazorpaySubscriptionStatus('subscription.charged', 'active'), 'active');
});

test('unknown and unsupported provider states are never defaulted to active', () => {
  assert.equal(mapRazorpaySubscriptionStatus('subscription.updated', 'new-provider-state'), null);
  assert.equal(mapRazorpaySubscriptionStatus('subscription.activated', 'new-provider-state'), null);
  assert.equal(mapRazorpaySubscriptionStatus('subscription.paused', 'paused'), null);
});

test('subscription cancellation and completion events remain explicit terminal transitions', () => {
  assert.equal(mapRazorpaySubscriptionStatus('subscription.cancelled', ''), 'canceled');
  assert.equal(mapRazorpaySubscriptionStatus('subscription.halted', ''), 'unpaid');
  assert.equal(mapRazorpaySubscriptionStatus('subscription.completed', ''), 'expired');
});

test('captured and refunded payment states are final against a late failure event', () => {
  assert.equal(isPaymentCaptureFinal('captured'), true);
  assert.equal(isPaymentCaptureFinal('partially_refunded'), true);
  assert.equal(isPaymentCaptureFinal('refunded'), true);
  assert.equal(isPaymentCaptureFinal('failed'), false);
  assert.equal(isPaymentCaptureFinal('authorized'), false);
});
