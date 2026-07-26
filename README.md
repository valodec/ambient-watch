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
