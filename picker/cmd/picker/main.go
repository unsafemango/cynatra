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
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/cynatra/picker/internal/cache"
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

	p := picker.New(tmdb.NewClient(key, c), look.NewScorer(c))

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
		t, err := p.Lookup(r.Context(), media, id, orDefault(r.URL.Query().Get("region"), "US"))
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
	mux.HandleFunc("GET /search", func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		if q == "" || len(q) > 100 {
			writeError(w, http.StatusBadRequest, "Type a title to search for.")
			return
		}
		hits, err := p.Search(r.Context(), q)
		if err != nil {
			log.Printf("search: %v", err)
			writeError(w, http.StatusBadGateway, "Search isn't working right now. Try again.")
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
