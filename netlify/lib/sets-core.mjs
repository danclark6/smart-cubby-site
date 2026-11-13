// Flashcard set storage logic, shared by the Netlify function and local tests.
// A "store" is anything with get(key, {type:"json"}), setJSON(key, value) and delete(key),
// which is exactly what Netlify Blobs' getStore() returns.

import { createHash, randomInt } from "node:crypto";

// No vowels (so codes can't spell words) and no look-alikes (0/O, 1/I/L).
const ALPHABET = "23456789BCDFGHJKMNPQRSTVWXYZ";

export const LIMITS = {
  titleChars: 80,
  sideChars: 300,
  minCards: 1,
  maxCards: 200,
  maxBodyBytes: 150_000,
};

function randomChars(n) {
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

// Share code: 6 characters shown as ABC-123 style, e.g. "K7P-4RW".
export function normalizeCode(raw) {
  const clean = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 6) return null;
  for (const ch of clean) if (!ALPHABET.includes(ch)) return null;
  return clean.slice(0, 3) + "-" + clean.slice(3);
}

function normalizeEditCode(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashEditCode(editCode) {
  return createHash("sha256").update("smart-cubby:" + normalizeEditCode(editCode)).digest("hex");
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function cleanText(v, max) {
  return String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

// Validate and tidy a set sent from the page. Returns {title, cards} or {error}.
export function cleanSet(input) {
  if (!input || typeof input !== "object") return { error: "Send a title and some cards." };
  const title = cleanText(input.title, LIMITS.titleChars);
  if (!title) return { error: "Give your set a name." };
  if (!Array.isArray(input.cards)) return { error: "Add at least one card." };
  const cards = input.cards
    .map((c) => ({ front: cleanText(c?.front, LIMITS.sideChars), back: cleanText(c?.back, LIMITS.sideChars) }))
    .filter((c) => c.front || c.back);
  if (cards.length < LIMITS.minCards) return { error: "Add at least one card." };
  if (cards.length > LIMITS.maxCards) return { error: `A set can have up to ${LIMITS.maxCards} cards.` };
  if (cards.some((c) => !c.front || !c.back)) return { error: "Every card needs both a front and a back." };
  return { title, cards };
}

function publicView(code, rec) {
  return { code, title: rec.title, cards: rec.cards, created: rec.created, updated: rec.updated };
}

async function readBody(req) {
  const text = await req.text();
  if (text.length > LIMITS.maxBodyBytes) return { tooBig: true };
  try { return { data: JSON.parse(text) }; } catch { return { data: null }; }
}

// Routes:
//   POST   /api/sets          {title, cards}            -> {code, editCode, ...set}
//   GET    /api/sets/:code                              -> set
//   PUT    /api/sets/:code    {editCode, title, cards}  -> set
//   DELETE /api/sets/:code    {editCode}                -> {deleted:true}
export async function handle(req, store, onEvent = async () => {}) {
  const note = (type, code) => onEvent(type, code).catch(() => {});
  const url = new URL(req.url);
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean); // ["api","sets",code?]
  if (parts[0] !== "api" || parts[1] !== "sets" || parts.length > 3) return json(404, { error: "Not found." });
  const rawCode = parts[2];

  if (!rawCode) {
    if (req.method !== "POST") return json(405, { error: "Use POST to make a new set." });
    const body = await readBody(req);
    if (body.tooBig) return json(413, { error: "That set is too big to save." });
    const set = cleanSet(body.data);
    if (set.error) return json(400, { error: set.error });

    let code = null;
    for (let i = 0; i < 8 && !code; i++) {
      const candidate = normalizeCode(randomChars(6));
      if (!(await store.get(candidate, { type: "json" }))) code = candidate;
    }
    if (!code) return json(503, { error: "Couldn't make a code just now. Try again." });

    const editCode = randomChars(4) + "-" + randomChars(4);
    const now = new Date().toISOString();
    const rec = { title: set.title, cards: set.cards, editHash: hashEditCode(editCode), created: now, updated: now };
    await store.setJSON(code, rec);
    await note("fc_create", code);
    return json(201, { ...publicView(code, rec), editCode });
  }

  const code = normalizeCode(rawCode);
  if (!code) return json(404, { error: "That code doesn't look right. Codes have 6 letters and numbers, like K7P-4RW." });
  const rec = await store.get(code, { type: "json" });
  if (!rec) return json(404, { error: "No set has that code. Check it and try again." });

  if (req.method === "GET") { await note("fc_open", code); return json(200, publicView(code, rec)); }

  if (req.method === "PUT" || req.method === "DELETE") {
    const body = await readBody(req);
    if (body.tooBig) return json(413, { error: "That set is too big to save." });
    const data = body.data || {};
    if (!data.editCode || hashEditCode(data.editCode) !== rec.editHash) {
      return json(403, { error: "That edit code doesn't match this set." });
    }
    if (req.method === "DELETE") {
      await store.delete(code);
      await note("fc_delete", code);
      return json(200, { deleted: true, code });
    }
    const set = cleanSet(data);
    if (set.error) return json(400, { error: set.error });
    const next = { ...rec, title: set.title, cards: set.cards, updated: new Date().toISOString() };
    await store.setJSON(code, next);
    if (!data.checkOnly) await note("fc_edit", code);
    return json(200, publicView(code, next));
  }

  return json(405, { error: "That action isn't supported." });
}
