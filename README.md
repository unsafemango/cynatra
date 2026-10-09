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

### Option A: everything in Docker

```bash
cp .env.example .env          # add TMDB_API_KEY
docker compose up --build     # web :3000, gateway :4000, picker :8081, postgres, redis, mailpit :8025
```

Open http://localhost:3000. The web image is a Next.js standalone build (non-root, with a health check).

`NEXT_PUBLIC_API_URL` is baked into the browser bundle when the web image is **built**, so it must be the gateway URL as the browser sees it. It defaults to `http://localhost:4000`; for another host set `PUBLIC_API_URL` in `.env` and rebuild (`docker compose build web`). If the site isn't on `http://localhost:3000`, also set `CORS_ORIGIN` to its URL and add it to your Google client's Authorized JavaScript origins. `WEB_PORT` changes the host port.

### Option A2: Docker backend, local frontend (hot reload)

```bash
docker compose up -d gateway  # starts gateway and everything it needs, not the web container
cd web && npm install && npm run dev   # http://localhost:3000
```

Stop the `web` container first (`docker compose stop web`) if it's running, since both use port 3000.

### Option B: no Docker

```bash
# 1. picker (in-memory cache if REDIS_URL is unset)
cd picker && TMDB_API_KEY=xxx go run ./cmd/picker

# 2. gateway (leave DATABASE_URL empty to skip accounts)
cd gateway && npm install && cp .env.example .env && npm run dev

# 3. web
cd web && npm install && npm run dev
```

## Email verification

Email sign-ups are confirmed with a 6-digit code before the account is created. Codes expire after 10 minutes, allow 5 tries, and can be resent once a minute.

- **Local (Docker):** emails go to Mailpit; open **http://localhost:8025** to read them. Nothing is delivered for real.
- **Gateway without Docker:** leave `SMTP_URL` empty and the code is printed in the gateway's terminal.
- **Real email (Brevo):** in Brevo, verify a sender address, then under *Settings → SMTP & API → SMTP* generate an SMTP key. In `.env` set `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER` (the SMTP login), `SMTP_PASS` (the SMTP key) and `EMAIL_FROM="Cynatra <your-verified-sender>"`, then `docker compose up -d gateway`. The gateway logs `email: ready via smtp-relay.brevo.com:587` when the credentials work. Any other SMTP provider works the same way.

## Sign in with Google (optional)

1. In [Google Cloud Console](https://console.cloud.google.com), create a project, then set up the OAuth consent screen (External).
2. **Credentials → Create credentials → OAuth client ID → Web application.** Under *Authorized JavaScript origins* add `http://localhost:3000` (and your real domain when you deploy). No redirect URIs are needed.
3. Put the client ID in `.env` as `GOOGLE_CLIENT_ID=…` (root `.env` for Docker, `gateway/.env` when running the gateway directly) and restart the gateway: `docker compose up -d gateway`.

The "Continue with Google" button appears on the login page once the gateway has a client ID. The gateway verifies Google's ID token, then signs the user in with a normal Cynatra session.

## API (gateway, port 4000)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/pick` | optional | Body: `{type, genres[], minRating, yearFrom?, yearTo?, maxRuntime?, language?, region?, excludeIds[], excludeSeen?}`. Logged-in picks skip seen and in-progress titles and are saved to history. |
| GET | `/api/genres` | – | Genre slugs and labels |
| GET | `/api/title/:media/:id` | – | One title (for share links) |
| GET | `/api/search?q=` | – | Movies and series matching a name (up to 8), for the Shortlist |
| POST | `/api/auth/register` | – | `{email, password}`: emails a 6-digit code; no account yet (202) |
| POST | `/api/auth/register/verify` | – | `{email, code}` → `{token, user}`: creates the account and signs in |
| POST | `/api/auth/register/resend` | – | `{email}`: new code (once a minute) |
| POST | `/api/auth/login` | – | `{email, password}` → `{token, user}` |
| POST | `/api/auth/google` | – | `{credential}` (Google ID token) → `{token, user}`. Creates the account, or links Google to an existing one with the same verified email. |
| GET | `/api/auth/config` | – | `{accounts, googleClientId}`: which sign-in options to show |
| GET/PATCH | `/api/auth/me` | ✓ | PATCH `{region}` sets the where-to-watch country |
| GET | `/api/me/counts` | ✓ | `{watchlist, watching, seen, history}` item counts |
| GET/POST | `/api/me/watchlist` | ✓ | POST a title object |
| DELETE | `/api/me/watchlist/:titleId` | ✓ | |
| POST | `/api/me/watchlist/pick` | ✓ | Random unseen title from the watchlist. Body: `{excludeIds[]}`. 404 with `code: "empty"` or `"exhausted"`. |
| GET/POST | `/api/me/watching` | ✓ | POST a title object; also removes it from the watchlist |
| DELETE | `/api/me/watching/:titleId` | ✓ | |
| GET/DELETE | `/api/me/history` | ✓ | |
| GET | `/api/me/seen` | ✓ | Titles marked as seen, newest first |
| PUT/DELETE | `/api/me/seen/:titleId` | ✓ | PUT body: the title object (optional, shown on the Seen tab). PUT also removes it from Watching. |

List endpoints (`GET /api/me/watchlist`, `/watching`, `/seen`, `/history`) are paginated: `?page=1&pageSize=10` (max 50), returning `{items, total, page, pageSize}`.

Title IDs look like `movie:155` or `tv:1399`.

## How a pick works

1. `type` resolves to one or more (kind, media) attempts. "Surprise me" shuffles movie, series, animated movie and animated series, and tries each until one matches.
2. Genres are ORed (`comedy|horror`). Movie and series are built with `without_genres=animation`; animation always requires the animation genre. TMDB has no TV genre for horror, romance, thriller, history or music, so those return nothing for series.
3. A vote-count floor (150 for movies, 80 for TV) keeps obscure 10/10s out.
4. The picker reads page 1 for the total, then samples random pages (capped at 100) until it finds an ID that isn't excluded.
5. **Bright & colourful look** (`look: "colorful"`): each candidate's backdrop and poster are scored for colourfulness (Hasler & Süsstrunk), brightness and hue variety, and only vivid ones are kept. Scores are cached for 30 days. Crime, thriller, horror and war are left out unless chosen as genres, because a vivid poster doesn't make a dark film light. Thresholds were calibrated on 12 vivid vs 12 dark titles (10/12 vs 0/12 pass).

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
