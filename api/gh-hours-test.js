function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOW_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Campus House: 7AM–7PM Every Day, Monday → Sunday
const WEEK = [
  { day: "Monday",    hours: "7AM–7PM" },
  { day: "Tuesday",   hours: "7AM–7PM" },
  { day: "Wednesday", hours: "7AM–7PM" },
  { day: "Thursday",  hours: "7AM–7PM" },
  { day: "Friday",    hours: "7AM–7PM" },
  { day: "Saturday",  hours: "7AM–7PM" },
  { day: "Sunday",    hours: "7AM–7PM" }
];

function weekToText(week) {
  return week.map(row => `${row.day}: ${row.hours}`).join("\n");
}

// Map real weekday → our Monday-first format
function labelForToday() {
  const jsDay = new Date().getDay(); // Sun=0
  const map = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday"
  };
  const todayName = map[jsDay];
  const found = WEEK.find(w => w.day === todayName);
  return found ? found.hours : "Hours unavailable";
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  // ---- WEEK JSON ----
  if (req.query.format === "week") {
    return res
      .status(200)
      .setHeader("content-type", "application/json")
      .json({ week: WEEK });
  }

  // ---- WEEK PLAIN TEXT ----
  if (req.query.format === "week_text") {
    return res
      .status(200)
      .setHeader("content-type", "text/plain; charset=UTF-8")
      .send(weekToText(WEEK));
  }

  // ---- TODAY ONLY ----
  return res
    .status(200)
    .setHeader("content-type", "text/plain; charset=UTF-8")
    .send(labelForToday());
}
