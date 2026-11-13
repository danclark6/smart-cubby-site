# smart-cubby.com

The code behind [smart-cubby.com](https://smart-cubby.com): free games and study tools for students. **No ads, no sign-ups, no tracking.**

- **Map Spotter**: click places on the map, with three tries each. Every continent and all 50 US states.
- **Flashcards**: make a set (or paste a list or a Quizlet export), quiz yourself, and share it with classmates using a short code.

## Want to help?

- **Found a bug or have an idea?** Open an issue in the **Issues** tab.
- **Want to change the code?** Read [CONTRIBUTING.md](CONTRIBUTING.md), then open a pull request.
- **Found a security problem?** Please report it privately. See [SECURITY.md](SECURITY.md).

GitHub accounts are for ages 13 and up. Younger students can ask a parent or teacher to post their idea.

## License

The code is free to reuse under the [MIT License](LICENSE). The Smart Cubby and Pigeon names, the pigeon mascot, and the `/schools` pages are not part of that license. See [TRADEMARKS.md](TRADEMARKS.md).

---

# Notes for the site owner

The rest of this file explains how the site is run.

- **Homepage** (`/`): Smart Cubby for students, with free games and study tools.
- **Unlisted sales pages** (`/schools/`): the original Smart Cubby phone-cabinet pitch for schools, plus the faculty portal demo. Nothing on the site links here, and search engines are told not to list these pages. Anyone with the link can still open them.

## Where everything lives

| What | Where |
| --- | --- |
| Domain name (smart-cubby.com) | **GoDaddy**. It only holds the name; its DNS points to Netlify. |
| Hosting | **Netlify**, site connected to this GitHub repository. |
| Website files | This repository, in the `public/` folder. |
| Saved flashcard sets | **Netlify Blobs**, store named `flashcard-sets`. In Netlify: open the site, then **Blobs**. |
| Usage counts | **Netlify Blobs**, store named `stats-events`. Read them at `smart-cubby.com/stats/` (password below). |

## How updates go live

Any change committed to this repository's `main` branch deploys automatically. It takes a minute or two. To check, look at the **Deploys** tab in Netlify. To undo a bad change, open an older deploy there and click **Publish deploy**.

You can edit or upload files right on github.com: open a folder, then **Add file → Upload files**.

## What's in this repository

```
public/                      the website, served as-is
  index.html                 homepage (mascot, tagline, list of games and tools)
  map-spotter/               Map Spotter geography game (one self-contained file)
  flashcards/                Flashcards: make, share and study card sets
  schools/                   hidden sales pages, PDF overview, cabinet photos
    smart-cubby-demo/        faculty portal demo
  _redirects                 old addresses (like /smart-cubby-demo/) now go to /schools/...
  stats/                     private usage report (password protected, hidden from search)
  _headers                   keeps /schools/ and /stats/ out of search engines
netlify/
  functions/sets.mjs         small server program that saves and loads flashcard sets
  functions/stats.mjs        records anonymous usage counts and builds the stats report
  lib/sets-core.mjs          the rules for sets: codes, size limits, edit-code checks
  lib/stats-core.mjs         what gets counted and how the report adds it up
netlify.toml                 tells Netlify to publish public/ and where the server program is
package.json                 the one add-on the server program needs (@netlify/blobs)
LICENSE, TRADEMARKS.md       what others may reuse (the code) and what stays yours (names, mascot, /schools)
CONTRIBUTING.md, SECURITY.md how people suggest changes or report problems
```

## Adding a new game or tool

1. Add a folder under `public/` (for example `public/word-search/index.html`). It becomes `smart-cubby.com/word-search/`.
2. Add a card for it on the homepage: copy one of the `<a class="game">` blocks in `public/index.html` and change the link, title, tags and description.
3. Link back to the homepage with `<a href="/">← Smart Cubby</a>` at the top of the new page.

## How Flashcards works

- A student makes a set. The site saves it and shows two codes:
  - a **share code** like `K7P-4RW` for classmates, who can type it in or use the link `smart-cubby.com/flashcards/#K7P-4RW`;
  - a private **edit code** like `MP9V-XR9B`, needed to change or delete the set.
- Codes use only consonants and the digits 2-9, so they can't spell words and you can't mix up 0/O or 1/I/L.
- Only the set name and the cards are saved. No names, emails or other personal details. The edit code is stored scrambled (hashed), so even we can't read it back.
- Limits: up to 200 cards per set, 300 characters per side, 80 characters per set name.
- **Paste a list:** in the editor, students can paste a word list, a Quizlet export, or a table copied from Google Docs, Word or a PDF, or open a .txt/.csv file. `public/flashcards/parse-list.js` splits each line at a tab, dash, equals sign, colon or comma. This happens entirely in the student's browser; nothing extra is sent anywhere.
- Sets never expire on their own.
- **To remove an inappropriate set:** in Netlify, open the site, then **Blobs** → `flashcard-sets`, find the entry named after the share code, and delete it.

## Usage stats

`smart-cubby.com/stats/` shows visits per day and per page, flashcard sets made, opened and studied (with % right), and Map Spotter games per map with average scores. Pick 7 days, 30 days, 90 days or a year.

- **Password:** set in Netlify under **Project configuration → Environment variables**, as `STATS_PASSWORD`. To change it, edit the value there and redeploy (Deploys → Trigger deploy).
- **What's counted:** only *what* was used: page opened, set made/opened/studied, map game started/finished and its score. No names, emails, IP addresses, cookies or device IDs. So the report shows how much the site is used, not how many different people use it.
- **Your own visits:** at the bottom of the stats page, tick "Don't count my own visits on this browser."
- **New games:** to count a new page, add the same small `scHit` script that's at the bottom of `public/index.html`, and add the page name to `PAGES` in `netlify/lib/stats-core.mjs` and in `public/stats/index.html`.
- Each count is one tiny entry in the `stats-events` store. To start the counts over, delete that store's entries in Netlify's Blobs page.

## Costs and limits

Netlify's free plan gives a monthly allowance of "credits" shared by the whole site. The flashcard and stats servers use very little, but every page visit now also makes one small server call to be counted. If the allowance ever runs out on the free plan, **the whole site goes offline until the next month**. Check usage under **Billing** in Netlify. A paid plan can top up automatically instead.

## Reviewing suggestions (open source)

This repository is public. Anyone can read it, and people with GitHub accounts can open issues and pull requests.

- **Nothing goes live until you merge it.** A pull request is only a proposal.
- **Deploy previews:** Netlify's *untrusted deploys policy* is set to **Require approval** (Project configuration → Developer settings → Continuous deployment). An outside pull request shows up at the top of the **Deploys** tab waiting for approval. **Don't approve one you haven't reviewed.** A preview runs the suggested code with access to the real flashcard storage.
- **Before merging,** look for anything that adds ads, sign-ups, outside scripts or trackers, sends data somewhere new, or touches `netlify/` (the server code). When in doubt, ask Claude or another developer to review it.
- **Security reports** arrive privately under the repository's **Security** tab.
