# Ambient Watch

A mobile-friendly web app that recommends TV series good for watching while
your hands and eyes are busy elsewhere — painting, jigsaw puzzles, cooking.

Give it TMDB show IDs for series you already like, and it asks Claude to
recommend similar shows scored on "ambient watchability": how well they hold
up when followed mostly by ear.

## How it works

1. You submit a comma-separated list of TMDB TV show IDs.
2. The server fetches each show's genres, overview, and keywords from TMDB.
3. That context is sent to Claude (`claude-opus-5`), which returns a
   structured list of recommendations with an ambient-watchability score and
   a reason for each pick.
4. Each recommended title is looked back up on TMDB for a poster and matched
   details.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY and TMDB_API_READ_TOKEN in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- `ANTHROPIC_API_KEY` — from the [Anthropic Console](https://console.anthropic.com/)
- `TMDB_API_READ_TOKEN` — the v4 "API Read Access Token" from your
  [TMDB account settings](https://www.themoviedb.org/settings/api)

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — lint
