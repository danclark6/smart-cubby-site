# Suggesting improvements

Thanks for helping make Smart Cubby better! This is the code behind [smart-cubby.com](https://smart-cubby.com), a free set of games and study tools for students.

## Who can contribute

Anyone with a GitHub account. GitHub requires users to be **13 or older**. Younger students: ask a parent, guardian or teacher to post your idea for you.

## Ground rules

Smart Cubby has three promises. Suggestions that break them won't be accepted:

1. **No ads.**
2. **No sign-ups.** Students never need an account, an email address or a password to play or study.
3. **No tracking.** The site only counts what gets used (for example, "a Map Spotter game was finished"), never who used it. No cookies, no IP addresses, no names, no outside analytics or tracking scripts.

Also:

- Be kind. Comments, issues and code should be fine for a classroom to read.
- Never post personal information: yours, a classmate's or anyone else's. That includes flashcard set codes and edit codes.
- Keep it simple. Each page is mostly a single HTML file with no build step, so a curious student can open it and see how it works.

## Ways to help

**Report a bug or share an idea.** Go to the **Issues** tab and click **New issue**. Say what you expected, what happened instead, and which page you were on. For a phone, say which phone and browser. Screenshots help.

**Suggest a code change.** Fork the repository, make your change, and open a **pull request** that explains what it changes and why. Nothing goes live until the site owner reviews it and merges it. Small, focused pull requests get reviewed fastest.

## How the code is organized

- `public/` is the website. Each game or tool has its own folder (for example `public/map-spotter/index.html`). These are plain HTML, CSS and JavaScript, and you can open most of them straight from your computer.
- `netlify/functions/` holds two small server programs: one saves and loads flashcard sets, the other counts anonymous usage. `netlify/lib/` has their logic.
- To run everything locally, including saving flashcards, install the [Netlify CLI](https://docs.netlify.com/cli/get-started/) and run `npm install` and then `netlify dev` in this folder.

## Ideas for new games and tools

New tools should work on a phone, work without an account, and teach or practice something real. If you have an idea, open an issue first so it can be discussed before you build it.

## Security problems

Please don't post security problems in public issues. See `SECURITY.md`.
