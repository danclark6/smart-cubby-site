// Name Hat rules that don't touch the page: cleaning the name list, drawing names,
// and packing each person's result into their private link.
// The page loads this file; tests/name-hat.test.mjs checks it.
//
// Privacy: a result lives only inside the part of the link after "#". Browsers never send
// that part to the website, so the site never sees or saves anyone's name or match.
(function (root) {
  const LIMITS = { minNames: 3, maxNames: 60, nameChars: 40, titleChars: 60, noteChars: 200 };

  const tidy = (s, max) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);

  // One name per line. Returns the names in order, plus any that appear twice (ignoring case).
  function cleanNames(text) {
    const names = String(text || "")
      .split(/\r?\n/)
      .map((l) => tidy(l.replace(/^\s*(?:\d{1,3}[.)]|[-•*])\s+/, ""), LIMITS.nameChars))
      .filter(Boolean);
    const seen = new Map(), dupes = [];
    for (const n of names) {
      const k = n.toLocaleLowerCase();
      if (seen.has(k) && !dupes.some((d) => d.toLocaleLowerCase() === k)) dupes.push(seen.get(k));
      if (!seen.has(k)) seen.set(k, n);
    }
    return { names, dupes };
  }

  // Random whole number from 0 to n-1, using the browser's (or Node's) secure random numbers.
  function randomInt(n, rand) {
    if (rand) return Math.floor(rand() * n);
    const c = root.crypto || (typeof globalThis !== "undefined" && globalThis.crypto);
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / n) * n; // avoid bias
    let x;
    do { c.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % n;
  }

  // Draw names: everyone gives to exactly one person and gets from exactly one person,
  // and nobody draws themselves. (Sattolo's shuffle makes one big loop, so it's always possible.)
  // Returns [{giver, receiver}] in the original order of names.
  function draw(names, rand) {
    const n = names.length;
    if (n < 2) throw new Error("Need at least 2 names");
    const order = names.map((_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = randomInt(i, rand); // j < i: this is what rules out drawing yourself
      [order[i], order[j]] = [order[j], order[i]];
    }
    // order is now one loop: the person at order[k] gives to order[k+1].
    const to = new Array(n);
    for (let k = 0; k < n; k++) to[order[k]] = order[(k + 1) % n];
    return names.map((giver, i) => ({ giver, receiver: names[to[i]] }));
  }

  // ---- private links ----
  // The result is scrambled so a name can't be read off the link at a glance (in an email
  // preview, or over someone's shoulder). This is not strong encryption: whoever has the
  // link can open it, which is the point. A short check catches links that got cut off.

  function utf8(s) { return new TextEncoder().encode(s); }
  function fromUtf8(b) { return new TextDecoder("utf-8", { fatal: true }).decode(b); }

  function b64url(bytes) {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromB64url(str) {
    const s = str.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(s + "===".slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  }

  // Keystream from a 32-bit seed (xorshift32).
  function mix(bytes, seed) {
    let x = seed >>> 0 || 0x9e3779b9;
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      out[i] = bytes[i] ^ (x & 0xff);
    }
    return out;
  }
  function check(bytes) { // 16-bit checksum
    let a = 1, b = 0;
    for (const v of bytes) { a = (a + v) % 251; b = (b + a) % 251; }
    return [a, b];
  }

  // {giver, receiver, title, note} -> code for the link (after "#")
  function packResult(r, rand) {
    const body = utf8(JSON.stringify({
      v: 1,
      g: tidy(r.giver, LIMITS.nameChars),
      r: tidy(r.receiver, LIMITS.nameChars),
      t: tidy(r.title, LIMITS.titleChars) || undefined,
      n: tidy(r.note, LIMITS.noteChars) || undefined,
    }));
    const seed = randomInt(0xffff, rand) * 0x10000 + randomInt(0xffff, rand);
    const head = [seed >>> 24, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255];
    const sum = check(body);
    return b64url(Uint8Array.from([...head, ...mix(Uint8Array.from([...sum, ...body]), seed)]));
  }

  // code -> {giver, receiver, title, note}, or null if the link is broken.
  function unpackResult(code) {
    try {
      const bytes = fromB64url(String(code || "").trim());
      if (bytes.length < 8) return null;
      const seed = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
      const plain = mix(bytes.slice(4), seed);
      const body = plain.slice(2), sum = check(body);
      if (plain[0] !== sum[0] || plain[1] !== sum[1]) return null;
      const d = JSON.parse(fromUtf8(body));
      if (d.v !== 1 || !d.g || !d.r) return null;
      return { giver: tidy(d.g, LIMITS.nameChars), receiver: tidy(d.r, LIMITS.nameChars), title: tidy(d.t, LIMITS.titleChars), note: tidy(d.n, LIMITS.noteChars) };
    } catch (e) {
      return null;
    }
  }

  root.NameHat = { LIMITS, cleanNames, draw, packResult, unpackResult };
})(typeof window !== "undefined" ? window : globalThis);
