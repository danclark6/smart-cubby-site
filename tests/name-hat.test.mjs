// Tests for Name Hat's rules (public/name-hat/name-hat-logic.js) and its usage counts.
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { cleanEvent } from "../netlify/lib/stats-core.mjs";

// Load the browser file the same way the page does.
const src = readFileSync(new URL("../public/name-hat/name-hat-logic.js", import.meta.url), "utf8");
const sandbox = { TextEncoder, TextDecoder, btoa, atob, crypto: globalThis.crypto, Uint8Array, Uint32Array };
sandbox.window = sandbox;
vm.runInNewContext(src, sandbox);
const { cleanNames, draw, packResult, unpackResult, LIMITS } = sandbox.NameHat;

const names = (n) => Array.from({ length: n }, (_, i) => "Kid " + (i + 1));

test("nobody draws themselves, and everyone gives and gets exactly once", () => {
  for (const n of [2, 3, 4, 7, 30, 60]) {
    for (let round = 0; round < 300; round++) {
      const list = names(n);
      const result = draw(list);
      assert.equal(result.length, n);
      assert.deepEqual(result.map((r) => r.giver), list, "results stay in the original order");
      for (const r of result) assert.notEqual(r.giver, r.receiver);
      assert.deepEqual([...result.map((r) => r.receiver)].sort(), [...list].sort(), "everyone is drawn once");
    }
  }
});

test("draws vary: every possible receiver comes up for the first person", () => {
  const list = names(5), seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(draw(list)[0].receiver);
  assert.deepEqual([...seen].sort(), ["Kid 2", "Kid 3", "Kid 4", "Kid 5"]);
});

test("a hat needs at least 2 names to draw", () => {
  assert.throws(() => draw(["Solo"]));
});

test("name list: one per line, blanks and numbering removed, spaces tidied", () => {
  const { names, dupes } = cleanNames("1. Maya\n\n  Leo   Park \n- Ana\n• Sam\r\nJosé\n");
  assert.deepEqual([...names], ["Maya", "Leo Park", "Ana", "Sam", "José"]);
  assert.deepEqual([...dupes], []);
});

test("name list: repeated names are reported once, ignoring capitals", () => {
  const { dupes } = cleanNames("Sam\nMaya\nsam\nSAM\nMaya");
  assert.deepEqual([...dupes], ["Sam", "Maya"]);
});

test("name list: very long names are cut to the limit", () => {
  const { names } = cleanNames("x".repeat(100));
  assert.equal(names[0].length, LIMITS.nameChars);
});

test("a private link opens to the same result, including accents and emoji", () => {
  const r = { giver: "Zoë", receiver: "José 🎁", title: "Room 204 gift swap", note: "Spend up to $10. We swap Friday, Dec 18." };
  const back = unpackResult(packResult(r));
  assert.deepEqual({ ...back }, r);
});

test("the receiver's name can't be read off the link", () => {
  for (let i = 0; i < 50; i++) {
    const code = packResult({ giver: "Maya", receiver: "Leonardo" });
    assert.ok(!/Leonardo|Maya/i.test(code));
    assert.ok(!/Leonardo|Maya/i.test(Buffer.from(code, "base64url").toString("latin1")));
    assert.match(code, /^[A-Za-z0-9_-]+$/, "only characters that are safe in a link");
  }
});

test("the same result gives a different link each time", () => {
  const r = { giver: "Maya", receiver: "Leo" };
  assert.notEqual(packResult(r), packResult(r));
});

test("links that got cut off or changed are rejected", () => {
  const code = packResult({ giver: "Maya", receiver: "Leo", note: "Swap on Friday" });
  assert.equal(unpackResult(code.slice(0, -3)), null, "cut off");
  const flipped = code.slice(0, 10) + (code[10] === "A" ? "B" : "A") + code.slice(11);
  assert.equal(unpackResult(flipped), null, "one character changed");
  assert.equal(unpackResult(""), null);
  assert.equal(unpackResult("not a real link!"), null);
});

test("a whole hat of 60 people makes links short enough for email", () => {
  const list = names(60);
  for (const r of draw(list)) {
    const code = packResult({ ...r, title: "t".repeat(60), note: "n".repeat(200) });
    assert.ok(code.length < 500, "link code is " + code.length + " characters");
  }
});

test("usage counts accept Name Hat events and nothing about the people", () => {
  assert.deepEqual(cleanEvent({ e: "view", p: "name-hat" }), ["view", "name-hat"]);
  assert.deepEqual(cleanEvent({ e: "nh_draw", n: 12 }), ["nh_draw", 12]);
  assert.deepEqual(cleanEvent({ e: "nh_reveal" }), ["nh_reveal"]);
  assert.equal(cleanEvent({ e: "nh_draw", n: 2 }), null, "below the minimum");
  assert.equal(cleanEvent({ e: "nh_draw", n: 61 }), null, "above the maximum");
  assert.equal(cleanEvent({ e: "nh_draw", n: "Maya" }), null, "names are never counted");
});
