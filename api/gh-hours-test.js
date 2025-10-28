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
 const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
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
  // always return today's hours (even if all same)
  const todayIdx = new Date().getDay(); // 0=Sun
  return week[todayIdx].hours || 'Hours unavailable';
}

// NEW: turn the 7-day array into newline-separated text (uses abbreviations except Sunday)
function weekToText(week, useAbbr = true) {
  const abbr = { Sunday:'Sunday', Monday:'Mon', Tuesday:'Tues', Wednesday:'Wed', Thursday:'Thurs', Friday:'Fri', Saturday:'Sat' };
  return week.map(row => `${useAbbr ? (abbr[row.day] || row.day) : row.day}: ${row.hours}`).join('\n');
}

// Handler
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end(); // preflight ok
  }

  const placeId = req.query.place_id || process.env.PLACE_ID;
  const key = process.env.Google_PLACES_KEY || process.env.GOOGLE_PLACES_KEY; // tolerate casing mistake
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
      .send(debug ? 'Missing place_id' : 'Hours unavailable (fallback)');
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

    // Weekly JSON mode (always 7 items when available)
    if (req.query.format === 'week') {
      return res
        .status(200)
        .setHeader('content-type', 'application/json')
        .setHeader('cache-control', `s-maxage=${process.env.CACHE_SECONDS || 900}, stale-while-revalidate=3600`)
        .json({ week: week || [] });
    }

    // NEW: Weekly plain text mode (newline-separated, always 7 lines)
    if (req.query.format === 'week_text') {
      const text = week ? weekToText(week, /*useAbbr*/ true) : 'Hours unavailable';
      return res
        .status(200)
        .setHeader('content-type','text/plain; charset=UTF-8')
        .setHeader('cache-control', `s-maxage=${process.env.CACHE_SECONDS || 900}, stale-while-revalidate=3600`)
        .send(text);
    }

    // Default: single-line (today's hours)
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
