# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Ambient Watch — a Next.js app that recommends TV series good for "ambient"
viewing (painting, puzzling, cooking). Multiple no-password profiles (a
"who's watching" picker), each with a persisted taste library (SQLite) that
improves recommendations over time via explicit watched/liked/disliked
feedback. Single Next.js project, App Router, TypeScript, Tailwind v4.

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
- `DB_PATH` — optional, SQLite file path (default `./data/ambient-watch.db`)

All three are read server-side only — never expose them to the client.

## Architecture

```
src/app/page.tsx (client)
  -> ProfilePicker ("who's watching", localStorage-remembered profile)
  -> RecommendationScreen
       search: GET /api/tmdb/search?q=       -> src/lib/tmdb.ts searchShows()  (autocomplete, TMDB token stays server-side)
       submit: POST /api/recommendations     { profileId, newTmdbIds }
                 -> upserts newTmdbIds into that profile's library as source='seed' (src/lib/db.ts)
                 -> src/lib/db.ts getTasteShows()/getDislikedShows()/getExclusionSet()
                 -> src/lib/tmdb.ts getShowById() per taste show (genres/overview/keywords for the prompt)
                 -> src/lib/claude.ts getRecommendations(tasteShows, alreadyKnownNames, dislikedNames, count)
                      -> Anthropic Messages API, model claude-opus-5, adaptive thinking,
                         output_config.format = Zod schema (structured output) via
                         `client.messages.parse()` from @anthropic-ai/sdk/helpers/zod
                 -> src/lib/tmdb.ts searchShowByName(title, firstAirYear) per recommendation
                      (year-aware match; falls back to stripping a ": "/"- " prefix if the
                      model decorates a title and the exact-name search misses)
                 -> server-side filter: drop any result whose resolved TMDB id is already
                    in that profile's library, even if Claude's own prompt instruction failed
       feedback: POST /api/library { profileId, tmdbId, name, firstAirYear, source, watched, rating }
                 -> upserts a library_entries row (src/lib/db.ts upsertLibraryEntry)
```

**Only two kinds of rows ever get written to `library_entries`**: shows
explicitly searched-and-submitted (`source='seed'`), and recommendations the
user explicitly tapped a feedback button on (`source='recommendation'`).
Recommendations merely displayed but not acted on are never persisted — see
`src/lib/db.ts` for the full comment on why.

**`src/lib/db.ts` lazily opens the SQLite connection** (on first query, not
at module import). This is load-bearing, not a style choice: `next build`
imports every route module from several parallel worker processes to
collect page metadata, and an eager `new DatabaseSync(...)` at module scope
means those workers race to open the same file and the build fails with
"database is locked". If you add a new DB-backed module, keep the same
lazy-singleton pattern.

The recommendation prompt/criteria for "ambient watchability" live in the
`SYSTEM_PROMPT` constant in `src/lib/claude.ts`. The `title` field's Zod
`.describe()` explicitly forbids decorating the title (e.g. "A darker
pick: Fargo") — the model did this in testing and it broke TMDB resolution;
if you see it recur, tighten that description further before adding more
fallback-parsing logic in `tmdb.ts`.

No authentication — profiles are unlocked, LAN-trust only (see README).

## Docker

`next.config.ts` sets `output: "standalone"`. The `Dockerfile` is a
multi-stage build (deps → builder → runner) that copies only the standalone
trace output plus `public/` and `.next/static` into the final image — do not
add `RUN npm install` steps to the `runner` stage, the standalone output is
already self-contained. `docker-compose.yml` expects a `.env` file (Compose's
default lookup name, distinct from `.env.local` used by `next dev`) providing
`ANTHROPIC_API_KEY` and `TMDB_API_READ_TOKEN`, plus a bind-mounted `./data`
volume for the SQLite file (see README's Data persistence note — the uid
1001/host ownership gotcha is a common redeploy failure mode). See README.md
for Portainer / Synology Container Manager deployment notes.

Persistence uses `node:sqlite` (Node's built-in driver, `@types/node` pinned
to `^22` so its types are available) rather than `better-sqlite3` or Prisma
— both ship native/prebuilt binaries that Next's standalone-output file
tracing doesn't reliably include, which would risk a runtime crash only
inside the container. `node:sqlite` needs no native compilation and was
verified directly against both `node:22-alpine` (this project's Docker base)
and `node:24-alpine` before committing to it.

## Next.js version note

This project pins a Next.js release newer than common training data
(`next@16.2.12`, App Router). If an API surface behaves unexpectedly, check
`node_modules/next/dist/docs/` (bundled docs) before assuming a remembered
API from an older Next.js version — route handler conventions, config
options, and caching defaults have changed across major versions.
