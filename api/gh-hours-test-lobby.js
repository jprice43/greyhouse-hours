
// Top of file
const ALLOW_ORIGINS = [
  'https://greyhousecoffee.com',
  'https://www.greyhousecoffee.com',
  'https://greyhousecoffee.myshopify.com' // replace with your myshopify domain
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOW_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin'); // important for caching
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Test-Token');
  }
}

// In your handler:
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end(); // preflight ok
  }
  
  const placeId = req.query.place_id_lobby || process.env.PLACE_ID_LOBBY;
  const key = process.env.GOOGLE_PLACES_KEY;

  const debug = req.query.debug === '1';

  if (!key) {
    return res.status(500).send(debug ? 'Missing GOOGLE_PLACES_KEY' : 'Hours unavailable (fallback)');
  }
  if (!placeId) {
    return res.status(400).send(debug ? 'Missing place_id_lobby' : 'Hours unavailable (fallback)');
  }

  try {
    const endpoint = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
    const headers = {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'id,displayName,currentOpeningHours.weekdayDescriptions,regularOpeningHours.weekdayDescriptions'
    };

    const r = await fetch(endpoint, { headers, cache: 'no-store' });
    const bodyText = await r.text(); // read body either way
    if (!r.ok) {
      if (debug) {
        return res
          .status(200)
          .setHeader('content-type', 'text/plain')
          .send(`ERROR ${r.status}: ${bodyText.slice(0, 400)}`);
      }
      return res.status(200).send('Hours unavailable (fallback)');
    }

    const data = JSON.parse(bodyText);
    const desc =
      data?.currentOpeningHours?.weekdayDescriptions ||
      data?.regularOpeningHours?.weekdayDescriptions;

    if (Array.isArray(desc) && desc.length >= 7) {
      const ranges = desc.map(d => (d.split(': ')[1] || '').trim());
      const tidy = s => s
        .replace(/\u202F/g, '')
        .replace(/\s*AM/g,'AM').replace(/\s*PM/g,'PM')
        .replace(/\s/g,'').replace(/:00/g,'');
      const clean = ranges.map(tidy);
      const allSame = clean.every(r => r === clean[0]);
      const label = allSame ? `${clean[0]} Daily` : (clean[new Date().getDay()] || 'Hours unavailable');
      return res.status(200).send(label);
    }

    return res.status(200).send(debug ? `NO HOURS: ${JSON.stringify(data).slice(0,400)}` : 'Hours unavailable (fallback)');

  } catch (e) {
    const msg = e?.message || String(e);
    return res.status(200).send(debug ? `EXCEPTION: ${msg}` : 'Hours unavailable (fallback)');
  }
}
