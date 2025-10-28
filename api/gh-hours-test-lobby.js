// Top of file
const ALLOW_ORIGINS = [
  'https://greyhousecoffee.com',
  'https://www.greyhousecoffee.com',
  'https://greyhousecoffee.myshopify.com' // your myshopify domain
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

function normalizeDescriptions(data) {
  // Prefer currentOpeningHours, then regularOpeningHours
  const desc =
    data?.currentOpeningHours?.weekdayDescriptions ||
    data?.regularOpeningHours?.weekdayDescriptions;

  if (!Array.isArray(desc) || desc.length < 7) return null;

  // desc entries look like: "Monday: 7 AM–9 PM"
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const map = {};
  for (const line of desc) {
    const [day, restRaw = ''] = line.split(': ');
    const tidy = restRaw
      .replace(/\u202F/g,'')
      .replace(/\s*AM/g,'AM')
      .replace(/\s*PM/g,'PM')
      .replace(/\s/g,'')
      .replace(/:00/g,'');
    map[day] = tidy || 'Closed';
  }
  return days.map(d => ({ day: d, hours: map[d] ?? 'Closed' }));
}

function labelForTodayOrDaily(week) {
  const allSame = week.every(x => x.hours === week[0].hours);
  if (allSame) return `${week[0].hours} Daily`;
  const todayIdx = new Date().getDay(); // 0=Sun
  return week[todayIdx].hours || 'Hours unavailable';
}

// Handler
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end(); // preflight ok
  }

  const placeId = req.query.place_id_lobby || process.env.PLACE_ID_LOBBY;
  const key = process.env.GOOGLE_PLACES_KEY;
  const debug = req.query.debug === '1';

  if (!key) {
    return res
      .status(500)
      .setHeader('content-type', 'text/plain')
      .send(debug ? 'Missing GOOGLE_PLACES_KEY' : 'Hours unavailable (fallback)');
  }
  if (!placeId) {
    return res
      .status(400)
      .setHeader('content-type', 'text/plain')
      .send(debug ? 'Missing place_id_lobby' : 'Hours unavailable (fallback)');
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
    const week = normalizeDescriptions(data);

    // Weekly JSON mode
    if (req.query.format === 'week') {
      return res
        .status(200)
        .setHeader('cache-control', `s-maxage=${process.env.CACHE_SECONDS || 900}, stale-while-revalidate=3600`)
        .json({ week: week || [] });
    }

    // Default: single-line text (Daily or today's hours)
    const label = week && week.length === 7 ? labelForTodayOrDaily(week) : 'Hours unavailable';
    return res
      .status(200)
      .setHeader('content-type','text/plain; charset=UTF-8')
      .setHeader('cache-control', `s-maxage=${process.env.CACHE_SECONDS || 900}, stale-while-revalidate=3600`)
      .send(label);

  } catch (e) {
    const msg = e?.message || String(e);
    return res
      .status(200)
      .setHeader('content-type','text/plain')
      .send(debug ? `EXCEPTION: ${msg}` : 'Hours unavailable (fallback)');
  }
}
