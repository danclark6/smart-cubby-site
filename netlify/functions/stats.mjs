// Netlify Function: anonymous usage counts (/api/hit) and the private report (/api/stats).
// The report password comes from the STATS_PASSWORD environment variable set in Netlify.
import { getStore } from "@netlify/blobs";
import { handleStats, EVENTS_STORE } from "../lib/stats-core.mjs";

export default async (req) => {
  try {
    return await handleStats(req, {
      eventStore: getStore({ name: EVENTS_STORE }),
      setStore: getStore({ name: "flashcard-sets" }),
      password: process.env.STATS_PASSWORD,
    });
  } catch (err) {
    console.error(err);
    const isHit = new URL(req.url).pathname.startsWith("/api/hit");
    return isHit
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify({ error: "Couldn't build the report. Try again in a minute." }), {
          status: 500, headers: { "content-type": "application/json; charset=utf-8" },
        });
  }
};

export const config = { path: ["/api/hit", "/api/stats"] };
