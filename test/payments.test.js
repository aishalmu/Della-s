const test = require('node:test');
const assert = require('node:assert/strict');
const { formEncode, createStripe } = require('../src/payments');

test('encodes nested Stripe parameters', () => {
  const body = formEncode({ mode: 'payment', line_items: { 0: { quantity: 1, price_data: { unit_amount: 1000 } } }, skip: undefined });
  assert.equal(
    decodeURIComponent(body.toString()),
    'mode=payment&line_items[0][quantity]=1&line_items[0][price_data][unit_amount]=1000',
  );
});

test('sends the secret key and reports Stripe errors', async () => {
  let seen;
  const stripe = createStripe('sk_test_123', async (url, opts) => {
    seen = { url, opts };
    return new Response(JSON.stringify({ error: { message: 'Invalid amount' } }), { status: 400 });
  });
  await assert.rejects(stripe.createCheckoutSession({ mode: 'payment' }), /Invalid amount/);
  assert.equal(seen.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(seen.opts.headers.Authorization, 'Bearer sk_test_123');
});
