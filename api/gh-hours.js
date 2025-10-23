// api/gh-hours.js
// Env vars: GOOGLE_PLACES_KEY, PLACE_ID (optional), SHOPIFY_APP_SECRET (for HMAC), CACHE_SECONDS=900

function safeEquals(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

function buildHmacBaseString(url) {
  // App Proxy verifies HMAC over the query params (excluding hmac/signature), sorted ascending and form-encoded.
  const u = new URL(url, 'http://x');
  const params = [...u.searchParams.entries()]
    .filter(([k]) => k !== 'hmac' && k !== 'signature')
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}=${v}`)
    .join('&');
  return params;
}

export default async function handler(req, res) {
  // --- 1) Verify Shopify App Proxy signature (recommended) ---
  try {
    const secret = process.env.SHOPIFY_APP_SECRET;
    if (secret) {
      const crypto = await import('node:crypto');
      const hmacParam = req.query.hmac || req.query.signature || '';
      const base = buildHmacBaseString(req.url);
      const calc = crypto.createHmac('sha256', secret).update(base, 'utf8').digest('hex');
      if (!safeEquals(calc, String(hmacParam))) {
        return res.status(401).setHeader('content-type', 'text/plain').send('Unauthorized');
      }
    }
  } catch {
    // If verification code throws (bad env, etc.), fail closed:
    return res.status(401).setHeader('content-type', 'text/plain').send('Unauthorized');
  }

  // --- 2) Gather inputs ---
  const placeId = req.query.place_id || process.env.PLACE_ID;
  if (!placeId) return res.status(400).send('Missing place_id');

  // --- 3) Call Google Places (v1) for weekdayDescriptions only ---
  const endpoint = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const headers = {
    'X-Goog-Api-Key': process.env.GOOGLE_PLACES_KEY,
    'X-Goog-FieldMask': 'regularOpeningHours.weekdayDescriptions'
  };

  // Optional: small edge cache
  const cacheSeconds = Number(process.env.CACHE_SECONDS || 900);

  try {
    const r = await fetch(endpoint, { headers, cache: 'no-store' });
    if (!r.ok) throw new Error(`Places ${r.status}`);
    const data = await r.json();
    const desc = data?.regularOpeningHours?.weekdayDescriptions;

    // Build the label: "7AM–6PM Daily" if all 7 days match, else today's hours
    let label = 'Hours unavailable';
    if (Array.isArray(desc) && desc.length >= 7) {
      const ranges = desc.map(d => (d.split(': ')[1] || '').trim());
      const tidy = s => s.replace(/\s*AM/g,'AM').replace(/\s*PM/g,'PM').replace(/\s/g,'').replace(/:00/g,'');
      const clean = ranges.map(tidy);
      const allSame = clean.every(r => r === clean[0]);
      label = allSame ? `${clean[0]} Daily` : clean[new Date().getDay()] || 'Hours unavailable';
    }

    res
      .status(200)
      .setHeader('content-type', 'text/plain; charset=UTF-8')
      .setHeader('cache-control', `s-maxage=${cacheSeconds}, stale-while-revalidate=3600`)
      .send(label);
  } catch {
    res.status(200).setHeader('content-type', 'text/plain').send('7AM–6PM Daily'); // safe fallback
  }
}
