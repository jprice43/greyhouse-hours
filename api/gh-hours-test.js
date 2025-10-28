// api/gh-hours-test.js
// Env vars: GOOGLE_PLACES_KEY, PLACE_ID (or pass ?place_id=...), TEST_TOKEN (optional)

export default async function handler(req, res) {
  try {
    // Optional simple guard so it’s not public:
    const needToken = process.env.TEST_TOKEN && process.env.TEST_TOKEN.length > 0;
    const provided = req.query.token || req.headers['x-test-token'];
    if (needToken && provided !== process.env.TEST_TOKEN) {
      res.status(401).setHeader('content-type', 'text/plain').send('Unauthorized');
      return;
    }

    const placeId = req.query.place_id || process.env.PLACE_ID;
    if (!placeId) {
      res.status(400).setHeader('content-type', 'text/plain').send('Missing place_id');
      return;
    }

    const endpoint = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
    const headers = {
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_KEY,
      'X-Goog-FieldMask': 'regularOpeningHours.weekdayDescriptions'
    };

    const r = await fetch(endpoint, { headers, cache: 'no-store' });
    if (!r.ok) throw new Error(`Places ${r.status}`);
    const data = await r.json();

    const desc = data?.regularOpeningHours?.weekdayDescriptions;
    let label = 'Hours unavailable';

    if (Array.isArray(desc) && desc.length >= 7) {
      // desc example: "Monday: 7 AM–6 PM"
      const ranges = desc.map(d => (d.split(': ')[1] || '').trim());
      const tidy = s => s.replace(/\s*AM/g,'AM').replace(/\s*PM/g,'PM').replace(/\s/g,'').replace(/:00/g,'');
      const clean = ranges.map(tidy);
      const allSame = clean.every(r => r === clean[0]);
      label = allSame ? `${clean[0]} Daily` : (clean[new Date().getDay()] || 'Hours unavailable');
    }

    res
      .status(200)
      .setHeader('content-type', 'text/plain; charset=UTF-8')
      .setHeader('cache-control', 's-maxage=900, stale-while-revalidate=3600')
      .send(label);
  } catch (e) {
    res.status(200).setHeader('content-type', 'text/plain').send('7AM–6PM Daily'); // safe fallback
  }
}
