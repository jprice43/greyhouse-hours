// api/gh-hours-test.js
// Env vars: GOOGLE_PLACES_KEY, PLACE_ID (or pass ?place_id=...), TEST_TOKEN (optional)

export default async function handler(req, res) {
  try {
    // --- Optional simple guard so it’s not public ---
    const needToken = !!(process.env.TEST_TOKEN && process.env.TEST_TOKEN.length > 0);
    const provided = req.query.token || req.headers['x-test-token'];
    if (needToken && provided !== process.env.TEST_TOKEN) {
      res.status(401).setHeader('content-type', 'text/plain').send('Unauthorized');
      return;
    }

    // --- Basic env sanity checks (helpful during setup) ---
    if (!process.env.GOOGLE_PLACES_KEY) {
      res.status(500).setHeader('content-type', 'text/plain').send('Missing GOOGLE_PLACES_KEY');
      return;
    }

    const placeId = req.query.place_id || process.env.PLACE_ID;
    if (!placeId) {
      res.status(400).setHeader('content-type', 'text/plain').send('Missing place_id');
      return;
    }

    // --- Google Places v1 request (ask for current + regular) ---
    const endpoint = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
    const headers = {
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_KEY,
      'X-Goog-FieldMask': [
        'currentOpeningHours.weekdayDescriptions',
        'regularOpeningHours.weekdayDescriptions'
      ].join(',')
    };

    const r = await fetch(endpoint, { headers, cache: 'no-store' });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`Places ${r.status}: ${body.slice(0, 200)}`);
    }
    const data = await r.json();

    // --- Prefer 'current' hours; fall back to 'regular' ---
    const desc =
      data?.currentOpeningHours?.weekdayDescriptions ||
      data?.regularOpeningHours?.weekdayDescriptions;

    let label = 'Hours unavailable';

    if (Array.isArray(desc) && desc.length >= 7) {
      // Example items: "Monday: 7 AM–9 PM"
      const ranges = desc.map(d => (d.split(': ')[1] || '').trim());

      // Clean up: drop spaces (including narrow no-break), drop :00, normalize AM/PM
      const tidy = s => s
        .replace(/\u202F/g, '')     // remove narrow no-break spaces
        .replace(/\s*AM/g, 'AM')
        .replace(/\s*PM/g, 'PM')
        .replace(/\s/g, '')         // remove remaining spaces
        .replace(/:00/g, '');       // drop :00 for a cleaner look

      const clean = ranges.map(tidy);
      const allSame = clean.every(r => r === clean[0]);

      label = allSame
        ? `${clean[0]} Daily`
        : (clean[new Date().getDay()] || 'Hours unavailable');
    }

    res
      .status(200)
      .setHeader('content-type', 'text/plain; charset=UTF-8')
      .setHeader('cache-control', 's-maxage=900, stale-while-revalidate=3600')
      .send(label);

  } catch (e) {
    // During testing, surface the failure instead of masking it
    console.error('Places fetch failed:', e?.message || e);
    res
      .status(200)
      .setHeader('content-type', 'text/plain')
      .send('Hours unavailable (fallback)'); // temporary; swap once stable
  }
}
