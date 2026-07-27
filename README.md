# Ambient Watch

A mobile-friendly web app (iOS design conventions throughout — system font,
safe-area insets, "Who's watching?" profile picker) that recommends TV series
good for watching while your hands and eyes are busy elsewhere — painting,
jigsaw puzzles, cooking.

Search for shows you already like by name (disambiguated by year — no more
guessing which "The Office"), and it asks Claude to recommend similar shows
scored on "ambient watchability": how well they hold up when followed mostly
by ear. Each household member gets their own no-password profile; marking a
recommendation watched/liked/disliked feeds back into that profile's future
recommendations.

## How it works

1. Pick or create a profile ("Who's watching?" — no password, just a name).
2. Search for shows you like by name; autocomplete resolves the exact
   TMDB entry (year shown to disambiguate remakes/reboots).
3. The server fetches each show's genres, overview, and keywords from TMDB,
   merges in everything already saved to that profile's library, and sends it
   to Claude (`claude-opus-5`), which returns a structured list of
   recommendations with an ambient-watchability score and a reason for each.
4. Anything already in the profile's library (seen, liked, or disliked) is
   filtered out server-side before the results are returned, even if the
   model's own exclusion instruction is imperfect.
5. Tap 👍/👎/✓ on any recommendation to save it to that profile's library —
   liked shows feed into future recommendations, everything is excluded from
   ever being recommended again.

## Data & persistence

Profiles and library entries are stored in SQLite via Node's built-in
`node:sqlite` driver (no native npm dependency — see `src/lib/db.ts`). The
database file path is `DB_PATH` (default `./data/ambient-watch.db`); in
Docker this is bind-mounted so data survives rebuilds (see below). There is
intentionally no authentication — profiles are just named, unlocked
"who's watching" slots. **Trust boundary: anyone who can reach the app can
act as any profile.** Fine on a home LAN; don't reverse-proxy this out to the
internet without adding auth first.

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
- `DB_PATH` — optional, defaults to `./data/ambient-watch.db`

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — lint

## Running with Docker

The repo includes a `Dockerfile` (multi-stage, Next.js standalone output) and
a `docker-compose.yml`. Works with plain `docker compose`, Synology Container
Manager, or Portainer.

### Plain Docker Compose

```bash
cp .env.example .env
# fill in ANTHROPIC_API_KEY and TMDB_API_READ_TOKEN in .env
docker compose up -d --build
```

Compose automatically reads variables from a `.env` file in the same
directory — that's the standard filename it looks for (not `.env.local`,
which is only used by `next dev`/`next build` outside Docker).

The app is then available at `http://<host>:3000`.

### Synology Container Manager

1. In Container Manager → **Project**, create a new project pointing at this
   repo folder (or upload `docker-compose.yml` + `Dockerfile`).
2. Add a `.env` file in the same project folder with `ANTHROPIC_API_KEY` and
   `TMDB_API_READ_TOKEN` set (Container Manager reads it the same way Compose
   does), or set both as environment variables in the project's settings.
3. Build and start the project. Port 3000 is exposed by default — remap it in
   the project's port settings if 3000 is already in use on your NAS.

### Portainer

1. **Stacks** → **Add stack** → paste the contents of `docker-compose.yml`
   (or point Portainer at this Git repo for GitOps-style redeploys).
2. In the stack's **Environment variables** section, add `ANTHROPIC_API_KEY`
   and `TMDB_API_READ_TOKEN` (or upload a `.env` file if your Portainer
   version supports it).
3. Deploy the stack.

### Notes

- The container needs outbound internet access to reach `api.anthropic.com`
  and `api.themoviedb.org` — no inbound access beyond port 3000 is required.
- Health check: `GET /` should return 200 once the container is up.
- To rebuild after pulling changes: `docker compose up -d --build`.
- **Data persistence**: `docker-compose.yml` bind-mounts `./data` to
  `/app/data` inside the container, where the SQLite database lives. The
  container runs as uid `1001` (a non-root `nextjs` user) — on first deploy,
  create the host directory and give it matching ownership before starting
  the stack, or the container gets a permission error on its first write:

  ```bash
  mkdir -p data && chown 1001:1001 data   # or: chmod 777 data
  ```
