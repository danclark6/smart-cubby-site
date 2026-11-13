// Anonymous usage counting for smart-cubby.com.
//
// Each event is saved as one tiny entry in the Netlify Blobs store "stats-events".
// All the information is in the entry's name, for example:
//   ev/2026-11-13/view/flashcards/-/-/lq3k9x7f2a
//   ev/2026-11-13/fc_round/K7P-4RW/20/17/lq3k9x7f2b
// No names, emails, IP addresses, cookies or device IDs are ever recorded.

import { randomBytes, timingSafeEqual, createHash } from "node:crypto";

export const EVENTS_STORE = "stats-events";
const TZ = "America/New_York";

const PAGES = new Set(["home", "flashcards", "map-spotter"]);
const CODE_RE = /^[23456789BCDFGHJKMNPQRSTVWXYZ]{3}-[23456789BCDFGHJKMNPQRSTVWXYZ]{3}$/;
const REGION_RE = /^[a-z0-9-]{1,32}$/;

export function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const intIn = (v, lo, hi) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};

// Turn an event from a page into its storage fields, or null if it isn't valid.
export function cleanEvent(ev) {
  if (!ev || typeof ev !== "object") return null;
  switch (ev.e) {
    case "view":
      return PAGES.has(ev.p) ? ["view", ev.p] : null;
    case "fc_round": {
      const n = intIn(ev.n, 1, 200), r = intIn(ev.r, 0, 200);
      return CODE_RE.test(ev.code || "") && n != null && r != null && r <= n ? ["fc_round", ev.code, n, r] : null;
    }
    case "ms_start":
      return REGION_RE.test(ev.region || "") ? ["ms_start", ev.region] : null;
    case "ms_finish": {
      const s = intIn(ev.score, 0, 100), n = intIn(ev.n, 1, 500);
      return REGION_RE.test(ev.region || "") && s != null && n != null ? ["ms_finish", ev.region, s, n] : null;
    }
    default:
      return null;
  }
}

// Events the flashcard server records itself (create/open/edit/delete).
export function serverEvent(type, code) {
  return ["fc_create", "fc_open", "fc_edit", "fc_delete"].includes(type) && CODE_RE.test(code) ? [type, code] : null;
}

export async function record(store, fields, date = new Date()) {
  if (!fields) return false;
  const parts = [...fields.map(String)];
  while (parts.length < 4) parts.push("-");
  const id = Date.now().toString(36) + randomBytes(4).toString("hex");
  await store.set(`ev/${dayKey(date)}/${parts.join("/")}/${id}`, "1");
  return true;
}

export function checkPassword(given, expected) {
  if (!expected || !given) return false;
  const a = createHash("sha256").update(String(given)).digest();
  const b = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(a, b);
}

async function listKeys(store, prefix) {
  const out = [];
  const res = await store.list({ prefix });
  for (const b of res.blobs || []) out.push(b.key);
  return out;
}

// Build the report for the last `days` days (today included).
export async function buildReport(eventStore, setStore, days, now = new Date()) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) dates.push(dayKey(new Date(now.getTime() - i * 86400000)));
  const dateSet = new Set(dates);

  // One listing for the whole range is cheaper than one per day once months match.
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
  const keys = (await Promise.all(months.map((m) => listKeys(eventStore, `ev/${m}`)))).flat();

  const daily = Object.fromEntries(dates.map((d) => [d, { date: d, home: 0, flashcards: 0, "map-spotter": 0, created: 0, rounds: 0, games: 0 }]));
  const views = { home: 0, flashcards: 0, "map-spotter": 0 };
  const fc = { created: 0, opened: 0, edited: 0, deleted: 0, rounds: 0, cardsStudied: 0, right: 0 };
  const sets = {};
  const regions = {};
  const setRow = (code) => (sets[code] ||= { code, opened: 0, rounds: 0, cardsStudied: 0, right: 0, createdInRange: false });
  const regionRow = (k) => (regions[k] ||= { region: k, started: 0, finished: 0, scoreSum: 0, placesSum: 0 });

  for (const key of keys) {
    const [, date, type, a, b, c] = key.split("/");
    if (!dateSet.has(date)) continue;
    const day = daily[date];
    switch (type) {
      case "view": if (a in views) { views[a]++; day[a]++; } break;
      case "fc_create": fc.created++; day.created++; setRow(a).createdInRange = true; break;
      case "fc_open": fc.opened++; setRow(a).opened++; break;
      case "fc_edit": fc.edited++; break;
      case "fc_delete": fc.deleted++; break;
      case "fc_round": {
        const n = +b || 0, r = +c || 0;
        fc.rounds++; fc.cardsStudied += n; fc.right += r; day.rounds++;
        const s = setRow(a); s.rounds++; s.cardsStudied += n; s.right += r;
        break;
      }
      case "ms_start": regionRow(a).started++; day.games++; break;
      case "ms_finish": { const g = regionRow(a); g.finished++; g.scoreSum += +b || 0; g.placesSum += +c || 0; break; }
    }
  }

  // Look up titles for the busiest sets.
  const top = Object.values(sets)
    .sort((x, y) => (y.rounds - x.rounds) || (y.opened - x.opened))
    .slice(0, 50);
  await Promise.all(top.map(async (s) => {
    try {
      const rec = await setStore.get(s.code, { type: "json" });
      if (rec) { s.title = rec.title; s.cards = rec.cards.length; s.created = rec.created; }
      else s.deletedSet = true;
    } catch { /* leave untitled */ }
  }));

  let storedSets = null;
  try { storedSets = (await setStore.list()).blobs.length; } catch {}

  return {
    range: { from: dates[0], to: dates[dates.length - 1], days, timeZone: TZ },
    daily: dates.map((d) => daily[d]),
    views,
    flashcards: { ...fc, storedSets },
    sets: top,
    regions: Object.values(regions)
      .map((g) => ({ region: g.region, started: g.started, finished: g.finished,
        avgScore: g.finished ? Math.round(g.scoreSum / g.finished) : null,
        placesFound: g.placesSum }))
      .sort((x, y) => y.started - x.started),
  };
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

// POST /api/hit    {e: "...", ...}             -> 204
// GET  /api/stats?days=30  (Authorization: Bearer <password>) -> report
export async function handleStats(req, { eventStore, setStore, password }) {
  const url = new URL(req.url);
  if (url.pathname.replace(/\/+$/, "") === "/api/hit") {
    if (req.method !== "POST") return json(405, { error: "Use POST." });
    const text = await req.text();
    if (text.length > 2000) return new Response(null, { status: 204 });
    let ev = null; try { ev = JSON.parse(text); } catch {}
    await record(eventStore, cleanEvent(ev));
    return new Response(null, { status: 204 });
  }
  if (url.pathname.replace(/\/+$/, "") === "/api/stats") {
    if (!password) return json(503, { error: "The stats password isn't set up yet. In Netlify, add an environment variable named STATS_PASSWORD, then redeploy." });
    const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!checkPassword(given, password)) return json(401, { error: "That password isn't right." });
    const days = [7, 30, 90, 365].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30;
    return json(200, await buildReport(eventStore, setStore, days));
  }
  return json(404, { error: "Not found." });
}
