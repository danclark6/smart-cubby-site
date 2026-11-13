// Netlify Function: saves and loads flashcard sets for /flashcards.
// Sets live in Netlify Blobs, in the store named "flashcard-sets" (one entry per share code).
import { getStore } from "@netlify/blobs";
import { handle } from "../lib/sets-core.mjs";
import { record, serverEvent, EVENTS_STORE } from "../lib/stats-core.mjs";

export default async (req) => {
  const store = getStore({ name: "flashcard-sets", consistency: "strong" });
  try {
    const events = getStore({ name: EVENTS_STORE });
    return await handle(req, store, (type, code) => record(events, serverEvent(type, code)));
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Something went wrong saving or loading cards. Try again in a minute." }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};

export const config = { path: ["/api/sets", "/api/sets/*"] };
