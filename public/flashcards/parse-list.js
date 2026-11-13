// Turns a pasted list into flashcards. Runs in the student's browser only.
// Handles: Quizlet exports and copied tables (tab), "word - meaning", "word = meaning",
// "word: meaning", "word, meaning" (CSV with quotes), numbered or bulleted lists,
// and terms/answers on alternating lines.
(function (root) {
  const MAX_SIDE = 300;

  // Separators in the order we trust them. Unspaced hyphens are left out on purpose
  // ("well-known", "self-portrait"), and so are bare spaces.
  const SEPS = [
    { id: "tab", label: "tabs", re: /\t+/ },
    { id: "eq", label: "equals signs", re: /\s*=\s*/ },
    { id: "dash", label: "dashes", re: /\s+[-–—]+\s+|\s*[–—]\s*/ },
    { id: "colon", label: "colons", re: /\s*:\s+|\s+:\s*/ },
    { id: "comma", label: "commas", re: null }, // handled by csvSplit
  ];

  const HEADER_FRONT = /^(term|terms|word|words|front|question|questions|vocab|vocabulary|french|spanish|german|latin|english|concept)$/i;
  const HEADER_BACK = /^(definition|definitions|meaning|meanings|back|answer|answers|translation|english|french|spanish)$/i;

  function stripBullet(line) {
    return line
      .replace(/^\s*(?:\(?\d{1,3}[.)]|\(?[a-z][.)](?=\s)|[•●◦▪*·]|-(?=\s))\s*/i, "")
      .trim();
  }

  function csvSplit(line) {
    // Split at the first comma that isn't inside quotes; unquote both halves.
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { i++; continue; }
        inQ = !inQ;
      } else if (ch === "," && !inQ) {
        return [unquote(line.slice(0, i)), unquote(line.slice(i + 1))];
      }
    }
    return null;
  }
  function unquote(s) {
    s = s.trim();
    if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') s = s.slice(1, -1).replace(/""/g, '"');
    // A CSV row can have extra empty columns ("bread,,") — drop trailing commas.
    return s.replace(/(,\s*)+$/, "").trim();
  }

  function splitWith(sep, line) {
    if (sep.id === "comma") return csvSplit(line);
    const m = sep.re.exec(line);
    if (!m || m.index === 0) return null;
    return [line.slice(0, m.index), line.slice(m.index + m[0].length)];
  }

  function clean(s) {
    return s.replace(/\s+/g, " ").trim();
  }

  function parseList(text, opts) {
    opts = opts || {};
    let rawLines = String(text || "").replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
    // Quizlet can export rows separated by semicolons, which arrives as one long line.
    if (rawLines.length === 1 && rawLines[0].includes(";") && (rawLines[0].includes("\t") || rawLines[0].split(";").length > 2)) {
      rawLines = rawLines[0].split(";");
    }
    const lines = rawLines.map((l) => l.replace(/ /g, " ")).filter((l) => l.trim());
    const result = { cards: [], skipped: [], sepLabel: null, mode: "pairs", truncated: 0, headerSkipped: false };
    if (!lines.length) return result;

    let pairs = [];
    if (opts.alternate) {
      result.mode = "alternate";
      const items = lines.map((l) => stripBullet(l)).filter(Boolean);
      for (let i = 0; i < items.length; i += 2) {
        if (i + 1 < items.length) pairs.push([items[i], items[i + 1]]);
        else result.skipped.push(items[i]);
      }
    } else {
      // Pick the most trusted separator that appears in most lines.
      const body = lines.map((l) => (/\t/.test(l) ? l.trim().replace(/^\t+|\t+$/g, "") : stripBullet(l)));
      let chosen = null;
      for (const sep of SEPS) {
        const hits = body.filter((l) => splitWith(sep, l)).length;
        if (hits && hits >= Math.max(1, Math.ceil(body.length * 0.6))) { chosen = sep; break; }
      }
      result.sepLabel = chosen ? chosen.label : null;
      body.forEach((l, i) => {
        let parts = chosen ? splitWith(chosen, l) : null;
        if (!parts) for (const sep of SEPS) { parts = splitWith(sep, l); if (parts) break; }
        if (parts && clean(parts[0]) && clean(parts[1])) pairs.push([parts[0], parts[1]]);
        else result.skipped.push(lines[i].trim());
      });
    }

    pairs = pairs.map(([a, b]) => [clean(a), clean(b)]);
    if (pairs.length && HEADER_FRONT.test(pairs[0][0]) && HEADER_BACK.test(pairs[0][1]) && pairs[0][0].toLowerCase() !== pairs[0][1].toLowerCase()) {
      pairs.shift();
      result.headerSkipped = true;
    }
    for (let [front, back] of pairs) {
      if (opts.swap) [front, back] = [back, front];
      if (front.length > MAX_SIDE || back.length > MAX_SIDE) result.truncated++;
      result.cards.push({ front: front.slice(0, MAX_SIDE), back: back.slice(0, MAX_SIDE) });
    }
    // Hint: nothing split, but an even number of lines looks like alternating term/answer.
    result.looksAlternate = !opts.alternate && result.cards.length === 0 && lines.length >= 2 && lines.length % 2 === 0;
    return result;
  }

  root.parseList = parseList;
  if (typeof module !== "undefined") module.exports = { parseList };
})(typeof window !== "undefined" ? window : globalThis);
