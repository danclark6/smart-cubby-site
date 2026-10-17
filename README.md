# smart-cubby.com

The website for **Smart Cubby** (the "Pigeon" brand).

- **Homepage** (`/`): Smart Cubby for students, with free games and study tools. No ads, no sign ups, no tracking.
- **Hidden sales pages** (`/schools/`): the original Smart Cubby phone-cabinet pitch for schools, plus the faculty portal demo. Nothing on the site links here, and search engines are told not to list these pages. Anyone with the link can still open them.

## Where everything lives

| What | Where |
| --- | --- |
| Domain name (smart-cubby.com) | **GoDaddy**. It only holds the name; its DNS points to Netlify. |
| Hosting | **Netlify**, site connected to this GitHub repository. |
| Website files | This repository, in the `public/` folder. |
| Saved flashcard sets | **Netlify Blobs**, store named `flashcard-sets`. In Netlify: open the site, then **Blobs**. |

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
  _headers                   keeps /schools/ out of search engines
netlify/
  functions/sets.mjs         small server program that saves and loads flashcard sets
  lib/sets-core.mjs          the rules for sets: codes, size limits, edit-code checks
netlify.toml                 tells Netlify to publish public/ and where the server program is
package.json                 the one add-on the server program needs (@netlify/blobs)
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
- Sets never expire on their own.
- **To remove an inappropriate set:** in Netlify, open the site, then **Blobs** → `flashcard-sets`, find the entry named after the share code, and delete it.

## Costs and limits

Netlify's free plan gives a monthly allowance of "credits" shared by the whole site. The flashcard server uses very little. If the allowance ever runs out on the free plan, **the whole site goes offline until the next month**. Check usage under **Billing** in Netlify. A paid plan can top up automatically instead.
