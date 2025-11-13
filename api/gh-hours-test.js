// ----- HARD CODED CAMPUS HOUSE HOURS -----

const ALLOW_ORIGINS = [
  'https://greyhousecoffee.com',
  'https://www.greyhousecoffee.com',
  'https://greyhousecoffee.myshopify.com'
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOW_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Campus House Hours (EVERY DAY 7AM–7PM)
const WEEK = [
  { day: "Thursday",   hours: "7AM–7PM" },
  { day: "Friday",     hours: "7AM–7PM" },
  { day: "Saturday",   hours: "7AM–7PM" },
  { day: "Sunday",     hours: "7AM–7PM" },
  { day: "Monday",     hours: "7AM–7PM" },
  { day: "Tuesday",    hours: "7AM–7PM" },
  { day: "Wednesday",  hours: "7AM–7PM" }
];

// Convert to plain text (newline separated)
function weekToText(week) {
  return week.map(row => `${row.day}: ${row.hours}`).join("\n");
}

// Get today's hours based on actual weekday
function labelForToday() {
  const idx = new Date().getDay(); // Sunday=0
  // Map to our custom week ordering
  const map = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday"
  };
  const todayName = map[idx];
  const found = WEEK.find(w => w.day === todayName);
  return found ? found.hours : "Hours unavailable";
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  // ----- JSON WEEK FORMAT -----
  if (req.query.format === "week") {
    return res
      .status(200)
      .setHeader("content-type", "application/json")
      .json({ week: WEEK });
  }

  // ----- PLAIN TEXT WEEK FORMAT -----
  if (req.query.format === "week_text") {
    return res
      .status(200)
      .setHeader("content-type", "text/plain; charset=UTF-8")
      .send(weekToText(WEEK));
  }

  // ----- DEFAULT: TODAY ONLY -----
  return res
    .status(200)
    .setHeader("content-type", "text/plain; charset=UTF-8")
    .send(labelForToday());
}
