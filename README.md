# Cynatra

Stop scrolling, start watching. Set a few filters, hit **Spin**, get one pick.

```
web (Next.js)  ──►  gateway (Node/TS)  ──►  picker (Go)  ──►  TMDB
                     │  accounts, JWT          │  filter + random pick
                     ▼                         ▼
                  PostgreSQL                 Redis (TMDB cache)
```

| Folder     | What it does |
|------------|--------------|
| `picker/`  | Go service. Turns filters (type, genres, min rating, year, runtime, language) into TMDB discover queries, picks a random page and a random title, skips excluded IDs, and returns details with trailer and where-to-watch. Caches TMDB responses in Redis, or in memory if Redis isn't available. |
| `gateway/` | Node + TypeScript (Express). The only API the frontend talks to. Handles sign-up/login (bcrypt + JWT), watchlist, pick history and "seen" marks in Postgres, and forwards picks to the Go service with the user's seen titles excluded. Runs without a database too (anonymous spins only). |
| `web/`     | Next.js + Tailwind. Spin screen with filters and vibe presets, result card with trailer, reroll, watchlist, "seen it" and share links (`/t/movie-155`), plus library and profile pages. |

## Run it locally

You need a free TMDB key: <https://www.themoviedb.org/settings/api> (the v3 API key or the v4 read access token both work).

### Option A: Docker for the backend

```bash
cp .env.example .env          # add TMDB_API_KEY
docker compose up --build     # postgres, redis, picker :8081, gateway :4000
cd web && npm install && npm run dev   # http://localhost:3000
```

### Option B: no Docker

```bash
# 1. picker (in-memory cache if REDIS_URL is unset)
cd picker && TMDB_API_KEY=xxx go run ./cmd/picker

# 2. gateway (leave DATABASE_URL empty to skip accounts)
cd gateway && npm install && cp .env.example .env && npm run dev

# 3. web
cd web && npm install && npm run dev
```

## API (gateway, port 4000)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/pick` | optional | Body: `{type, genres[], minRating, yearFrom?, yearTo?, maxRuntime?, language?, region?, excludeIds[], excludeSeen?}`. Logged-in picks skip seen titles and are saved to history. |
| GET | `/api/genres` | – | Genre slugs and labels |
| GET | `/api/title/:media/:id` | – | One title (for share links) |
| POST | `/api/auth/register`, `/api/auth/login` | – | `{email, password}` → `{token, user}` |
| GET/PATCH | `/api/auth/me` | ✓ | PATCH `{region}` sets the where-to-watch country |
| GET/POST | `/api/me/watchlist` | ✓ | POST a title object |
| DELETE | `/api/me/watchlist/:titleId` | ✓ | |
| GET/DELETE | `/api/me/history` | ✓ | |
| GET | `/api/me/seen` | ✓ | Titles marked as seen, newest first |
| PUT/DELETE | `/api/me/seen/:titleId` | ✓ | PUT body: the title object (optional, shown on the Seen tab) |

Title IDs look like `movie:155` or `tv:1399`.

## How a pick works

1. `type` resolves to one or more (kind, media) attempts. "Surprise me" shuffles movie, series, animated movie and animated series, and tries each until one matches.
2. Genres are ORed (`comedy|horror`). Movie and series are built with `without_genres=animation`; animation always requires the animation genre. TMDB has no TV genre for horror, romance, thriller, history or music, so those return nothing for series.
3. A vote-count floor (150 for movies, 80 for TV) keeps obscure 10/10s out.
4. The picker reads page 1 for the total, then samples random pages (capped at 100) until it finds an ID that isn't excluded.

## Tests

```bash
cd picker && go test ./...
cd gateway && npm run typecheck
cd web && npm run lint && npm run build
```

## Deploying

- **web** → Vercel. Set `NEXT_PUBLIC_API_URL` to the gateway URL.
- **picker**, **gateway** → Railway, Render or Fly.io using their Dockerfiles. Set `CORS_ORIGIN` on the gateway to your web URL and use a real `JWT_SECRET`.

## Next up

- Group mode: a room where friends vote or spin together
- Daily pick
- React Native app reusing `lib/api.ts`
- gRPC between gateway and picker if REST becomes a bottleneck

---

This product uses the TMDB API but is not endorsed or certified by TMDB.
