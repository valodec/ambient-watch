# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ambient Watch — a Next.js app that recommends TV series good for "ambient"
viewing (painting, puzzling, cooking) based on TMDB show IDs the user already
likes. Single Next.js project, App Router, TypeScript, Tailwind v4.

## Commands

```bash
npm run dev      # start dev server (Turbopack) at http://localhost:3000
npm run build    # production build
npm run start    # run the production build
npm run lint     # eslint
npx tsc --noEmit # type-check without emitting
```

There is no test suite configured yet.

## Environment

Copy `.env.example` to `.env.local` and set:

- `ANTHROPIC_API_KEY` — Anthropic Console
- `TMDB_API_READ_TOKEN` — TMDB v4 API Read Access Token (Bearer token, not the v3 API key)

Both are read server-side only (`src/lib/claude.ts`, `src/lib/tmdb.ts`) — never expose them to the client.

## Architecture

Request flow for the one feature this app has:

```
page.tsx (client form)
  -> POST /api/recommendations   { tmdbIds: number[] }
       -> src/lib/tmdb.ts   getShowById() for each input ID (TMDB /tv/{id} + /tv/{id}/keywords)
       -> src/lib/claude.ts getRecommendations(shows, count)
            -> Anthropic Messages API, model claude-opus-5, adaptive thinking,
               output_config.format = Zod schema (structured output) via
               `client.messages.parse()` from @anthropic-ai/sdk/helpers/zod
       -> src/lib/tmdb.ts   searchShowByName() per recommendation, to attach
          poster/details back onto Claude's picks (Claude returns titles/years,
          not TMDB IDs, so results are matched back by name search)
  <- JSON: { inputShows, results: [{ title, firstAirYear, ambientWatchabilityScore, reason, tmdb }] }
```

Key point for future changes: Claude never sees or returns TMDB IDs for its
recommendations — it reasons over show titles/metadata and returns titles,
which are then re-resolved against TMDB. If you need tighter ID-level
matching (e.g. to avoid mismatches on remakes), that resolution step in
`route.ts` is where to add disambiguation (the `firstAirYear` field exists
for this reason but isn't yet used to disambiguate search results).

The recommendation prompt/criteria for "ambient watchability" live in the
`SYSTEM_PROMPT` constant in `src/lib/claude.ts` — that's the single place
tuning the recommendation behavior.

## Docker

`next.config.ts` sets `output: "standalone"`. The `Dockerfile` is a
multi-stage build (deps → builder → runner) that copies only the standalone
trace output plus `public/` and `.next/static` into the final image — do not
add `RUN npm install` steps to the `runner` stage, the standalone output is
already self-contained. `docker-compose.yml` expects a `.env` file (Compose's
default lookup name, distinct from `.env.local` used by `next dev`) providing
`ANTHROPIC_API_KEY` and `TMDB_API_READ_TOKEN`. See README.md for Portainer /
Synology Container Manager deployment notes.

## Next.js version note

This project pins a Next.js release newer than common training data
(`next@16.2.12`, App Router). If an API surface behaves unexpectedly, check
`node_modules/next/dist/docs/` (bundled docs) before assuming a remembered
API from an older Next.js version — route handler conventions, config
options, and caching defaults have changed across major versions.
