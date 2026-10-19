// Command picker is Cynatra's pick service: filters in, one random title out.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/cynatra/picker/internal/cache"
	"github.com/cynatra/picker/internal/imdb"
	"github.com/cynatra/picker/internal/look"
	"github.com/cynatra/picker/internal/picker"
	"github.com/cynatra/picker/internal/tmdb"
)

func main() {
	key := os.Getenv("TMDB_API_KEY")
	if key == "" {
		log.Fatal("TMDB_API_KEY is required (v3 API key or v4 read access token)")
	}
	port := envOr("PORT", "8081")

	ctx := context.Background()
	c, kind := cache.New(ctx, os.Getenv("REDIS_URL"))
	log.Printf("cache: %s", kind)

	// IMDb ratings load in the background; until then TMDB's score stands in.
	ratings := &imdb.Ratings{}
	go ratings.Keep(ctx, envOr("IMDB_RATINGS_URL", imdb.DatasetURL), 24*time.Hour)
	p := picker.New(tmdb.NewClient(key, c), look.NewScorer(c), ratings)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "cache": kind})
	})
	mux.HandleFunc("GET /genres", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, picker.Genres)
	})
	mux.HandleFunc("GET /title/{media}/{id}", func(w http.ResponseWriter, r *http.Request) {
		media := r.PathValue("media")
		id, err := strconv.Atoi(r.PathValue("id"))
		if (media != "movie" && media != "tv") || err != nil || id <= 0 {
			writeError(w, http.StatusBadRequest, "invalid title")
			return
		}
		t, err := p.Lookup(r.Context(), media, id, orDefault(r.URL.Query().Get("region"), picker.DefaultRegion))
		switch {
		case errors.Is(err, tmdb.ErrNotFound):
			writeError(w, http.StatusNotFound, "Title not found.")
		case err != nil:
			log.Printf("lookup: %v", err)
			writeError(w, http.StatusBadGateway, "Couldn't reach the movie database. Try again.")
		default:
			writeJSON(w, http.StatusOK, t)
		}
	})
	mux.HandleFunc("GET /title/{media}/{id}/full", func(w http.ResponseWriter, r *http.Request) {
		media := r.PathValue("media")
		id, err := strconv.Atoi(r.PathValue("id"))
		if (media != "movie" && media != "tv") || err != nil || id <= 0 {
			writeError(w, http.StatusBadRequest, "invalid title")
			return
		}
		t, err := p.Full(r.Context(), media, id, orDefault(r.URL.Query().Get("region"), picker.DefaultRegion))
		switch {
		case errors.Is(err, tmdb.ErrNotFound):
			writeError(w, http.StatusNotFound, "Title not found.")
		case err != nil:
			log.Printf("full: %v", err)
			writeError(w, http.StatusBadGateway, "Couldn't reach the movie database. Try again.")
		default:
			writeJSON(w, http.StatusOK, t)
		}
	})
	mux.HandleFunc("GET /person/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.Atoi(r.PathValue("id"))
		if err != nil || id <= 0 {
			writeError(w, http.StatusBadRequest, "invalid person")
			return
		}
		person, err := p.Person(r.Context(), id)
		switch {
		case errors.Is(err, tmdb.ErrNotFound):
			writeError(w, http.StatusNotFound, "Person not found.")
		case err != nil:
			log.Printf("person: %v", err)
			writeError(w, http.StatusBadGateway, "Couldn't reach the movie database. Try again.")
		default:
			writeJSON(w, http.StatusOK, person)
		}
	})
	mux.HandleFunc("GET /episodes", func(w http.ResponseWriter, r *http.Request) {
		ids := strings.Split(r.URL.Query().Get("credits"), ",")
		if len(ids) > picker.MaxCreditsPerLookup || slices.ContainsFunc(ids, func(id string) bool { return !creditID.MatchString(id) }) {
			writeError(w, http.StatusBadRequest, "invalid credits")
			return
		}
		a, err := p.Episodes(r.Context(), ids)
		if err != nil {
			log.Printf("episodes: %v", err)
			writeError(w, http.StatusBadGateway, "Couldn't reach the movie database. Try again.")
			return
		}
		writeJSON(w, http.StatusOK, a)
	})
	mux.HandleFunc("GET /providers", func(w http.ResponseWriter, r *http.Request) {
		region := strings.ToUpper(orDefault(r.URL.Query().Get("region"), picker.DefaultRegion))
		if len(region) != 2 {
			writeError(w, http.StatusBadRequest, "invalid region")
			return
		}
		options, err := p.Providers(r.Context(), region)
		if err != nil {
			log.Printf("providers: %v", err)
			writeError(w, http.StatusBadGateway, "Couldn't reach the movie database. Try again.")
			return
		}
		writeJSON(w, http.StatusOK, options)
	})
	mux.HandleFunc("POST /services", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			IDs    []string `json:"ids"`
			Region string   `json:"region"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<17)).Decode(&req); err != nil || len(req.IDs) > picker.MaxServicesTitles {
			writeError(w, http.StatusBadRequest, "invalid request")
			return
		}
		writeJSON(w, http.StatusOK, p.Services(r.Context(), req.IDs, orDefault(req.Region, picker.DefaultRegion)))
	})
	mux.HandleFunc("POST /ratings", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			IDs []string `json:"ids"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&req); err != nil || len(req.IDs) > picker.MaxRatingsLookup {
			writeError(w, http.StatusBadRequest, "invalid ids")
			return
		}
		writeJSON(w, http.StatusOK, p.IMDbRatings(r.Context(), req.IDs))
	})
	mux.HandleFunc("GET /search", func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		if q == "" || len(q) > 100 {
			writeError(w, http.StatusBadRequest, "Type a title to search for.")
			return
		}
		// The shortlist shows a few; the search page asks for up to a full TMDB page.
		limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
		if err != nil || limit < 1 || limit > 20 {
			limit = 8
		}
		hits, err := p.Search(r.Context(), q, limit)
		if err != nil {
			log.Printf("search: %v", err)
			writeError(w, http.StatusBadGateway, "Search isn't working right now. Try again.")
			return
		}
		writeJSON(w, http.StatusOK, hits)
	})
	// Well-known titles or people for the web app's sitemap: ?media=movie|tv|person&pages=N (20 per page).
	mux.HandleFunc("GET /popular", func(w http.ResponseWriter, r *http.Request) {
		media := r.URL.Query().Get("media")
		if media != "movie" && media != "tv" && media != "person" {
			writeError(w, http.StatusBadRequest, "media must be movie, tv or person")
			return
		}
		pages, err := strconv.Atoi(r.URL.Query().Get("pages"))
		if err != nil || pages < 1 || pages > picker.MaxPopularPages {
			pages = 10
		}
		ids, err := p.Popular(r.Context(), media, pages)
		if err != nil {
			log.Printf("popular: %v", err)
			writeError(w, http.StatusBadGateway, "Couldn't list popular titles.")
			return
		}
		writeJSON(w, http.StatusOK, ids)
	})
	// Most popular titles matching Spin filters, for landing pages: {"request": {...}, "limit": N}.
	mux.HandleFunc("POST /browse", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Request picker.Request `json:"request"`
			Limit   int            `json:"limit"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		if body.Limit < 1 || body.Limit > picker.MaxBrowse {
			body.Limit = 20
		}
		hits, err := p.Browse(r.Context(), body.Request, body.Limit)
		if err != nil {
			log.Printf("browse: %v", err)
			writeError(w, http.StatusBadGateway, "Couldn't list titles right now.")
			return
		}
		writeJSON(w, http.StatusOK, hits)
	})
	mux.HandleFunc("POST /pick", func(w http.ResponseWriter, r *http.Request) {
		var req picker.Request
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		if err := picker.Normalize(&req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer cancel()
		t, err := p.Pick(ctx, req)
		switch {
		case errors.Is(err, picker.ErrNoMatch):
			writeError(w, http.StatusNotFound, "Nothing matches those filters. Try loosening them.")
		case errors.Is(err, picker.ErrNoServices):
			writeError(w, http.StatusNotFound, "None of those streaming services are available in your country. Pick others in the filters.")
		case err != nil:
			log.Printf("pick: %v", err)
			writeError(w, http.StatusBadGateway, "Couldn't reach the movie database. Try again.")
		default:
			writeJSON(w, http.StatusOK, t)
		}
	})

	srv := &http.Server{Addr: ":" + port, Handler: logRequests(mux), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		log.Printf("picker listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdownCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}

// TMDB credit IDs are 24 hex characters.
var creditID = regexp.MustCompile(`^[0-9a-f]{24}$`)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}

func envOr(k, def string) string {
	return orDefault(os.Getenv(k), def)
}

func orDefault(v, def string) string {
	if v != "" {
		return v
	}
	return def
}
