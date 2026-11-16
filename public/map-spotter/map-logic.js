// Map Spotter rules that don't touch the page: map addresses, modes, scoring and base maps.
// The game page loads this file; tests/map-spotter.test.mjs checks it.
(function (root) {
  const HOME_URL = "/map-spotter/";

  // Points for finding a place on the 1st, 2nd or 3rd try, or missing it (4).
  const POINTS = { 1: 100, 2: 67, 3: 33, 4: 0 };

  // Average score in %, or null before anything is answered. results: id -> try number (1-4).
  function scoreOf(results) {
    const vals = Object.values(results);
    if (!vals.length) return null;
    return Math.round(vals.reduce((s, v) => s + POINTS[v], 0) / vals.length);
  }

  // Helpers that need the menu (names, sizes, outlines of every map).
  // A map can have more than one mode (Manhattan: neighborhoods or landmarks). Only the main map gets a
  // card; the others have "parent" set. Each mode is its own map file, best score and address.
  function withMenu(menu) {
    const baseOf = (key) => menu[key].parent || key;
    const modesOf = (key) => Object.keys(menu).filter((k) => k === baseOf(key) || menu[k].parent === baseOf(key));
    // Addresses: /map-spotter/manhattan, /map-spotter/manhattan/landmarks
    const urlOf = (key) => {
      const p = menu[key].parent;
      return HOME_URL + (p ? p + "/" + key.slice(p.length + 1) : key);
    };
    // The map an address asks for, or null for the list of maps (or an unknown address).
    const keyFromPath = (path) => {
      const key = path.replace(/^\/map-spotter\/?/, "").split("/").filter(Boolean).join("-");
      return Object.prototype.hasOwnProperty.call(menu, key) ? key : null;
    };
    return { baseOf, modesOf, urlOf, keyFromPath };
  }

  // A map with "base" (Manhattan Landmarks) holds only its own places. The base map's places
  // are drawn under them as plain land, with the base map's grey background.
  function withBase(data, base) {
    return Object.assign({}, data, {
      land: base.game.map((g) => g.d).filter(Boolean),
      context: base.context,
    });
  }

  root.MapLogic = { HOME_URL, POINTS, scoreOf, withMenu, withBase };
})(typeof window !== "undefined" ? window : globalThis);
