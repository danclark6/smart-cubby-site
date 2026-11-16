// Map Spotter tests. Run with: npm test
// Checks the game's rules (map-logic.js) and every map file against the menu in the game page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ROOT = new URL("../public/", import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), "utf8");
const readMap = (key) => JSON.parse(read("map-spotter/maps/" + key + ".json"));

// map-logic.js is a plain browser script: run it with a stand-in "window" and pick up window.MapLogic.
const win = {};
new Function("window", read("map-spotter/map-logic.js"))(win);
const { HOME_URL, scoreOf, withMenu, withBase } = win.MapLogic;

// The menu and card order live in the game page.
const page = read("map-spotter/index.html");
const MENU = JSON.parse(page.match(/<script id="mapmenu" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const ORDER = JSON.parse(page.match(/const ORDER = (\[[^\]]*\]);/)[1]);
const KEYS = Object.keys(MENU);
const { baseOf, modesOf, urlOf, keyFromPath } = withMenu(MENU);

// ---------- scoring ----------

test("score is null before anything is answered", () => {
  assert.equal(scoreOf({}), null);
});

test("score is the average of 100 / 67 / 33 / 0 points per try, rounded", () => {
  assert.equal(scoreOf({ a: 1 }), 100);
  assert.equal(scoreOf({ a: 4 }), 0);
  assert.equal(scoreOf({ a: 1, b: 4 }), 50);
  assert.equal(scoreOf({ a: 2, b: 3 }), 50);
  assert.equal(scoreOf({ a: 1, b: 2, c: 2 }), 78); // 234 / 3 = 78
});

// ---------- addresses ----------

test("each map has its own address", () => {
  assert.equal(urlOf("europe"), "/map-spotter/europe");
  assert.equal(urlOf("manhattan"), "/map-spotter/manhattan");
  assert.equal(urlOf("manhattan-landmarks"), "/map-spotter/manhattan/landmarks");
});

test("every map's address leads back to that map", () => {
  for (const key of KEYS) assert.equal(keyFromPath(urlOf(key)), key, key);
});

test("addresses work with or without a trailing slash", () => {
  assert.equal(keyFromPath("/map-spotter/manhattan/"), "manhattan");
  assert.equal(keyFromPath("/map-spotter/manhattan/landmarks/"), "manhattan-landmarks");
});

test("the list of maps and unknown addresses give no map", () => {
  assert.equal(keyFromPath(HOME_URL), null);
  assert.equal(keyFromPath("/map-spotter"), null);
  assert.equal(keyFromPath("/map-spotter/nowhere"), null);
  assert.equal(keyFromPath("/map-spotter/manhattan/nowhere"), null);
  assert.equal(keyFromPath("/map-spotter/toString"), null); // not fooled by built-in object names
});

test("unknown map addresses are sent to the game page", () => {
  assert.match(read("_redirects"), /^\/map-spotter\/\*\s+\/map-spotter\/index\.html\s+200\s*$/m);
});

// ---------- modes ----------

test("Manhattan has two modes, found from either one", () => {
  assert.deepEqual(modesOf("manhattan"), ["manhattan", "manhattan-landmarks"]);
  assert.deepEqual(modesOf("manhattan-landmarks"), ["manhattan", "manhattan-landmarks"]);
  assert.equal(baseOf("manhattan-landmarks"), "manhattan");
  assert.equal(baseOf("manhattan"), "manhattan");
});

test("maps without modes have just one", () => {
  assert.deepEqual(modesOf("europe"), ["europe"]);
});

test("only main maps get a card; every mode has a button name", () => {
  for (const key of KEYS) {
    const { parent } = MENU[key];
    if (parent) {
      assert.ok(!ORDER.includes(key), key + " is a mode and should not have its own card");
      assert.ok(ORDER.includes(parent), key + ": its main map " + parent + " needs a card");
    } else {
      assert.ok(ORDER.includes(key), key + " has no card");
    }
    if (modesOf(key).length > 1) assert.ok(MENU[key].mode, key + " needs a mode name for the switch");
  }
  assert.equal(new Set(ORDER).size, ORDER.length, "a card is listed twice");
});

// ---------- base maps ----------

test("a base map's places become plain land, with its background", () => {
  const data = { label: "Dots", base: "b", game: [{ id: "x", name: "X", dot: true, cx: 1, cy: 2 }] };
  const base = { game: [{ id: "a", d: "M0,0L1,0L1,1Z" }, { id: "dot", dot: true, cx: 0, cy: 0 }], context: ["M5,5L6,6Z"] };
  const out = withBase(data, base);
  assert.deepEqual(out.land, ["M0,0L1,0L1,1Z"]); // dots in the base map are not land
  assert.deepEqual(out.context, ["M5,5L6,6Z"]);
  assert.deepEqual(out.game, data.game);
  assert.equal(data.land, undefined, "the original map data is left unchanged");
});

// ---------- map files ----------

for (const key of KEYS) {
  test("map file " + key + ".json matches the menu", () => {
    assert.ok(existsSync(new URL("map-spotter/maps/" + key + ".json", ROOT)), "missing file");
    const map = readMap(key), menu = MENU[key];
    assert.equal(map.label, menu.label);
    assert.equal(map.game.length, menu.count, "the menu's count is wrong");
    if (map.unit || menu.unit) assert.equal(map.unit, menu.unit);
    if (map.w) assert.deepEqual([map.w, map.h], [menu.w, menu.h], "size differs from the menu");

    const ids = map.game.map((g) => g.id), names = map.game.map((g) => g.name);
    assert.equal(new Set(ids).size, ids.length, "two places share an id");
    assert.equal(new Set(names).size, names.length, "two places share a name");
    for (const g of map.game) {
      assert.ok(g.id && g.name, "a place has no id or name");
      assert.ok(g.d || (g.dot && Number.isFinite(g.cx) && Number.isFinite(g.cy)), g.name + " has no outline or dot");
    }

    if (map.base) {
      assert.ok(MENU[map.base], "base map " + map.base + " is not in the menu");
      assert.ok(!map.land && !map.context, "a map with a base should not copy the base map's shapes");
      assert.deepEqual([menu.w, menu.h], [MENU[map.base].w, MENU[map.base].h], "size differs from the base map");
    } else {
      assert.ok(Array.isArray(map.context), "no background shapes");
    }
  });
}

test("every map is in the stats report", () => {
  const regions = read("stats/index.html").match(/const REGIONS = (\{[^}]*\});/)[1];
  for (const key of KEYS) assert.ok(regions.includes(key + ":") || regions.includes('"' + key + '":'), key);
});

// ---------- Manhattan (issue #3) ----------

const manhattan = readMap("manhattan");
const hoods = manhattan.game.map((g) => g.name);

test("Manhattan uses the corrected neighborhood names", () => {
  for (const name of [
    "Financial District-Wall Street-Battery Park City",
    "Tribeca",
    "Upper East Side-Lenox Hill",
    "Roosevelt Island",
    "East Harlem",
    "Central Harlem",
    "Upper West Side-Lincoln Center",
    "SoHo-Little Italy",
    "Midtown East-Turtle Bay",
    "Flatiron-Union Square",
    "Washington Heights",
    "Chinatown",
  ]) assert.ok(hoods.includes(name), name);
});

test("Manhattan no longer has the old names", () => {
  for (const name of [
    "Financial District-Battery Park City",
    "Tribeca-Civic Center",
    "Upper East Side-Lenox Hill-Roosevelt Island",
    "United Nations",
    "East Harlem (North)",
    "East Harlem (South)",
    "Harlem (North)",
    "Harlem (South)",
    "Upper West Side-Lincoln Square",
    "SoHo-Little Italy-Hudson Square",
    "East Midtown-Turtle Bay",
    "Midtown South-Flatiron-Union Square",
    "Washington Heights (North)",
    "Washington Heights (South)",
    "Chinatown-Two Bridges",
  ]) assert.ok(!hoods.includes(name), name);
});

// Is the point inside the outline? (even-odd rule over every ring of an "M…L…Z" path)
function inside(x, y, d) {
  let hit = false;
  for (const ring of d.split("M").filter(Boolean)) {
    const pts = [...ring.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[j];
      if ((y1 > y) !== (y2 > y) && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) hit = !hit;
    }
  }
  return hit;
}

test("the landmarks are the 12 from the issue", () => {
  const names = readMap("manhattan-landmarks").game.map((g) => g.name).sort();
  assert.deepEqual(names, [
    "American Museum of Natural History", "Apollo Theater", "Empire State Building", "Ethical Culture",
    "Flatiron Building", "Grand Central Terminal", "Lincoln Center", "MoMA", "The Cloisters", "The Met",
    "United Nations", "World Trade Center",
  ]);
});

test("each landmark sits in the right neighborhood", () => {
  const expected = {
    "American Museum of Natural History": "Upper West Side (Central)",
    "Apollo Theater": "Central Harlem",
    "Empire State Building": "Flatiron-Union Square",
    "Ethical Culture": "Upper West Side-Lincoln Center",
    "Flatiron Building": "Flatiron-Union Square",
    "Grand Central Terminal": "Midtown East-Turtle Bay",
    "Lincoln Center": "Upper West Side-Lincoln Center",
    "MoMA": "Midtown-Times Square",
    "The Cloisters": "Washington Heights",
    "The Met": "Central Park",
    "United Nations": "Midtown East-Turtle Bay",
    "World Trade Center": "Financial District-Wall Street-Battery Park City",
  };
  for (const lm of readMap("manhattan-landmarks").game) {
    const found = manhattan.game.filter((h) => inside(lm.cx, lm.cy, h.d)).map((h) => h.name);
    assert.deepEqual(found, [expected[lm.name]], lm.name);
  }
});
