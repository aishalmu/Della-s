// Minimal Stripe Checkout client for taking booking deposits.
// Stripe pays the money out to Della's bank account (Halifax).

const API = 'https://api.stripe.com/v1';

// Stripe takes form-encoded bodies with bracketed keys for nested objects.
function formEncode(value, prefix = '', out = new URLSearchParams()) {
  if (value === undefined || value === null) return out;
  if (typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      formEncode(v, prefix ? `${prefix}[${key}]` : key, out);
    }
  } else {
    out.append(prefix, String(value));
  }
  return out;
}

function createStripe(secretKey, fetchImpl = fetch) {
  async function call(method, path, body) {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: body ? formEncode(body).toString() : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `Stripe returned ${res.status}`);
    return data;
  }

  return {
    createCheckoutSession: (params) => call('POST', '/checkout/sessions', params),
    retrieveCheckoutSession: (id) => call('GET', `/checkout/sessions/${encodeURIComponent(id)}`),
    expireCheckoutSession: (id) => call('POST', `/checkout/sessions/${encodeURIComponent(id)}/expire`),
  };
}

module.exports = { createStripe, formEncode };
