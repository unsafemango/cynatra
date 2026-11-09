# Cynatra

Cynatra is a movie and series recommendation app. Users set a few filters and receive a single title to watch, along with its trailer and streaming availability.

## Architecture

```
web (Next.js)  ──►  gateway (Node/TS)  ──►  picker (Go)  ──►  TMDB
                     │  accounts, JWT          │  filter + random pick
                     ▼                         ▼
                  PostgreSQL                 Redis (TMDB cache)
```

| Directory  | Description |
|------------|-------------|
| `picker/`  | Go service. Converts filters (type, genres, minimum rating, year, runtime, language) into TMDB discover queries, selects a random title, skips excluded IDs, and returns details with the trailer and streaming availability. Caches TMDB responses in Redis, or in memory if Redis is unavailable. |
| `gateway/` | Node and TypeScript (Express) service. The only API the frontend calls. Handles sign-up and login (bcrypt and JWT), stores the watchlist, pick history and seen titles in PostgreSQL, and forwards pick requests to the picker with the user's seen titles excluded. Without a database, it serves anonymous picks only. |
| `web/`     | Next.js and Tailwind frontend. Includes the pick screen with filters and presets, discovery pages, title and person pages, library and profile pages, and shareable title links (`/t/movie-155`). |
| `k8s/`     | Kubernetes manifests: a shared base with staging and production overlays. |

## Getting started

### Prerequisites

- A TMDB API key from <https://www.themoviedb.org/settings/api> (the v3 API key or the v4 read access token)
- Docker with Docker Compose, or Node.js 22 and Go 1.26 to run without Docker

### Run with Docker

```bash
cp .env.example .env          # set TMDB_API_KEY
docker compose up --build
```

| Service | Address |
|---------|---------|
| Web | <http://localhost:3000> |
| Gateway | <http://localhost:4000> |
| Picker | <http://localhost:8081> |
| Mailpit (local email inbox) | <http://localhost:8025> |

PostgreSQL and Redis also start as part of the stack.

The following settings apply when the site is not served from `http://localhost:3000`:

- `PUBLIC_API_URL` is the gateway URL as the browser sees it. It defaults to `http://localhost:4000` and is built into the browser bundle, so rebuild after changing it (`docker compose build web`).
- `CORS_ORIGIN` must be set to the site's URL. Also add that URL to the Google client's authorized JavaScript origins if Google sign-in is enabled.
- `WEB_PORT` changes the host port for the web container.

### Run the frontend locally with hot reload

This option runs the backend in Docker and the frontend on the host. Both frontends use port 3000, so stop the web container first if it is running (`docker compose stop web`).

```bash
docker compose up -d gateway  # starts the gateway and its dependencies
cd web && npm install && npm run dev
```

### Run without Docker

Start each service in its own terminal:

```bash
# Picker: uses an in-memory cache if REDIS_URL is unset
cd picker && TMDB_API_KEY=<your-key> go run ./cmd/picker
```

```bash
# Gateway: leave DATABASE_URL empty to run without accounts
cd gateway && npm install && cp .env.example .env && npm run dev
```

```bash
# Web
cd web && npm install && npm run dev
```

## Configuration

### Email verification

Email sign-ups are confirmed with a 6-digit code before the account is created. Codes expire after 10 minutes, allow 5 attempts, and can be resent once a minute.

- **Docker:** messages go to the Mailpit inbox at <http://localhost:8025> and are not delivered externally.
- **Without Docker:** if `SMTP_URL` is empty, the gateway prints the code to its terminal.
- **SMTP delivery:** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `EMAIL_FROM` in `.env`, using a sender address verified with the provider, then run `docker compose up -d gateway`. For example, Brevo uses `SMTP_HOST=smtp-relay.brevo.com` and `SMTP_PORT=587`, with credentials from *Settings → SMTP & API → SMTP*. When the connection succeeds, the gateway logs `email: ready via <host>:<port>`.

### Google sign-in (optional)

1. In the [Google Cloud Console](https://console.cloud.google.com), create a project and configure the OAuth consent screen (External).
2. Under **Credentials → Create credentials → OAuth client ID → Web application**, add `http://localhost:3000` and any deployed domains to *Authorized JavaScript origins*. Redirect URIs are not required.
3. Set `GOOGLE_CLIENT_ID` in the root `.env` for Docker, or in `gateway/.env` when running the gateway directly, and restart the gateway.

The login page shows the Google button once the gateway has a client ID. The gateway verifies Google's ID token and then issues a standard Cynatra session.

## API

The gateway listens on port 4000. Title IDs use the format `movie:155` or `tv:1399`.

### Titles and picks

Authentication is optional for `POST /api/pick` and is not used by the other endpoints in this table.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pick` | Returns one random title. Body: `{type, genres[], minRating, yearFrom?, yearTo?, maxRuntime?, language?, region?, excludeIds[], excludeSeen?}`. Picks for signed-in users skip seen and in-progress titles and are saved to history. |
| POST | `/api/browse` | Most popular titles matching the pick filters |
| GET | `/api/genres` | Genre slugs and labels |
| GET | `/api/providers?region=` | Streaming services available in a country |
| GET | `/api/search?q=` | Movies and series matching a name (up to 8) |
| GET | `/api/popular?media=&pages=` | IDs of well-known movies, series or people, used for the sitemap |
| GET | `/api/title/:media/:id` | A single title |
| GET | `/api/title/:media/:id/full` | A single title with cast, crew and seasons |
| GET | `/api/person/:id` | An actor or crew member with their filmography |
| GET | `/api/episodes?credits=` | Episodes or seasons covered by up to 5 TMDB credit IDs |

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | None | `{email, password}`. Emails a 6-digit code and returns 202. The account is not created yet. |
| POST | `/api/auth/register/verify` | None | `{email, code}` → `{token, user}`. Creates the account and signs in. |
| POST | `/api/auth/register/resend` | None | `{email}`. Sends a new code, at most once a minute. |
| POST | `/api/auth/login` | None | `{email, password}` → `{token, user}` |
| POST | `/api/auth/google` | None | `{credential}` (Google ID token) → `{token, user}`. Creates an account, or links Google to an existing account with the same verified email. |
| GET | `/api/auth/config` | None | `{accounts, googleClientId}`: the available sign-in options |
| GET, PATCH | `/api/auth/me` | Required | The current user. `PATCH {region}` sets the country used for streaming availability. |

### User library

All `/api/me` endpoints require authentication.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me/counts` | Item counts: `{watchlist, watching, seen, history}` |
| GET | `/api/me/status/:titleId` | Where a title is in the library: `seen`, `watching`, `watchlist` or `null` |
| GET, POST | `/api/me/watchlist` | List the watchlist, or add a title object |
| DELETE | `/api/me/watchlist/:titleId` | Remove a title from the watchlist |
| POST | `/api/me/watchlist/pick` | Random unseen title from the watchlist. Body: `{excludeIds[]}`. Returns 404 with `code: "empty"` or `"exhausted"` when none is available. |
| GET, POST | `/api/me/watching` | List in-progress titles, or add a title object (this also removes it from the watchlist) |
| DELETE | `/api/me/watching/:titleId` | Remove a title from Watching |
| GET, DELETE | `/api/me/history` | List or clear pick history |
| GET | `/api/me/seen` | Titles marked as seen, newest first |
| PUT, DELETE | `/api/me/seen/:titleId` | Mark or unmark a title as seen. The optional PUT body is the title object. PUT also removes the title from Watching. |
| POST | `/api/me/seen/import` | `{ids[]}`. Copies seen marks made while signed out to the account. |
| GET, PUT | `/api/me/services` | Streaming services for the user's Watchlist and Watching titles, or update the user's subscriptions |
| GET | `/api/me/services/subscribed` | Services the user subscribes to |
| GET | `/api/me/services/library` | Services that carry titles in the library, with a count for each tab |

`GET /api/me/watchlist`, `/watching`, `/seen` and `/history` are paginated with `?page=1&pageSize=10` (maximum 50) and return `{items, total, page, pageSize}`.

### Support

`POST /api/support` submits the Help page's contact form. Authentication is optional; replies to signed-in users go to the account's email address.

## Pick algorithm

1. `type` resolves to one or more combinations of kind and media. "Surprise me" shuffles movies, series, animated movies and animated series, then tries each until one returns a match.
2. Genres are combined with OR (`comedy|horror`). Movie and series queries exclude animation, and animation queries always require it. TMDB has no TV genre for horror, romance, thriller, history or music, so those genres return no series.
3. A minimum vote count (150 for movies, 80 for TV) excludes highly rated titles with too few votes to be meaningful.
4. The picker reads page 1 to get the total, then samples random pages (up to page 100) until it finds an ID that is not excluded.
5. The optional colorful filter (`look: "colorful"`) scores each candidate's backdrop and poster for colorfulness (Hasler and Süsstrunk), brightness and hue variety, and keeps only vivid titles. Scores are cached for 30 days. Crime, thriller, horror and war titles are excluded unless selected as genres.

## Testing

```bash
cd picker && go test ./...
cd gateway && npm run typecheck && npm test
cd web && npm run lint && npm run build
```

The gateway tests read `gateway/.env` and require a running PostgreSQL database.

## Deployment

[DEPLOY.md](DEPLOY.md) describes deploying the full stack to Kubernetes (k3s) with HTTPS on a custom domain.

The services can also run on managed platforms:

- **Web:** Vercel, with `NEXT_PUBLIC_API_URL` set to the gateway URL.
- **Picker and gateway:** any platform that runs Dockerfiles, such as Render, Koyeb, Railway or Fly.io. Set `CORS_ORIGIN` on the gateway to the web URL and use a strong, unique `JWT_SECRET`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching, pull request and release process.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.
