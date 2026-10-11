// Package imdb serves IMDb ratings from IMDb's free daily dataset
// (title.ratings.tsv.gz, non-commercial use), held in memory.
package imdb

import (
	"bufio"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

const DatasetURL = "https://datasets.imdbws.com/title.ratings.tsv.gz"

type Score struct {
	Rating float64 `json:"rating"` // 1–10, one decimal
	Votes  int     `json:"votes"`
}

// Ratings maps IMDb IDs ("tt0133093") to scores. 1.5M+ titles fit in about
// 13 MB as two sorted slices: the numeric ID, and rating×10 packed with votes.
type Ratings struct {
	mu   sync.RWMutex
	ids  []uint32
	vals []uint32
}

const voteBits = 24 // votes are capped at 16.7M, well above any title's

// Loaded reports whether a dataset has been loaded yet.
func (r *Ratings) Loaded() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.ids) > 0
}

// Lookup returns the score for an IMDb ID, if IMDb has one.
func (r *Ratings) Lookup(imdbID string) (Score, bool) {
	id, ok := parseID(imdbID)
	if !ok {
		return Score{}, false
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	i, found := slices.BinarySearch(r.ids, id)
	if !found {
		return Score{}, false
	}
	v := r.vals[i]
	return Score{Rating: float64(v>>voteBits) / 10, Votes: int(v & (1<<voteBits - 1))}, true
}

// Load downloads the dataset and swaps it in.
func (r *Ratings) Load(ctx context.Context, url string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := (&http.Client{Timeout: 5 * time.Minute}).Do(req)
	if err != nil {
		return fmt.Errorf("imdb download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("imdb download: status %d", resp.StatusCode)
	}
	gz, err := gzip.NewReader(resp.Body)
	if err != nil {
		return fmt.Errorf("imdb download: %w", err)
	}
	ids, vals, err := Parse(gz)
	if err != nil {
		return err
	}
	r.mu.Lock()
	r.ids, r.vals = ids, vals
	r.mu.Unlock()
	return nil
}

// Keep loads the dataset now and then every `every`, retrying sooner after a
// failure, until ctx ends. Until the first load, Lookup finds nothing.
func (r *Ratings) Keep(ctx context.Context, url string, every time.Duration) {
	for {
		wait := every
		start := time.Now()
		if err := r.Load(ctx, url); err != nil {
			log.Printf("imdb ratings: %v", err)
			wait = 10 * time.Minute
		} else {
			r.mu.RLock()
			log.Printf("imdb ratings: %d titles loaded in %s", len(r.ids), time.Since(start).Round(time.Millisecond))
			r.mu.RUnlock()
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
		}
	}
}

// Parse reads the uncompressed TSV: tconst, averageRating, numVotes.
func Parse(rd io.Reader) (ids, vals []uint32, err error) {
	sc := bufio.NewScanner(rd)
	header := true
	for sc.Scan() {
		if header {
			header = false
			continue
		}
		fields := strings.Split(sc.Text(), "\t")
		if len(fields) != 3 {
			continue
		}
		id, ok := parseID(fields[0])
		rating, err1 := strconv.ParseFloat(fields[1], 64)
		votes, err2 := strconv.Atoi(fields[2])
		if !ok || err1 != nil || err2 != nil {
			continue
		}
		ids = append(ids, id)
		vals = append(vals, uint32(math.Round(rating*10))<<voteBits|uint32(min(votes, 1<<voteBits-1)))
	}
	if err := sc.Err(); err != nil {
		return nil, nil, fmt.Errorf("imdb parse: %w", err)
	}
	if len(ids) == 0 {
		return nil, nil, fmt.Errorf("imdb parse: no ratings")
	}
	// The file comes sorted by ID; make sure, since lookups depend on it.
	if !slices.IsSorted(ids) {
		idx := make([]int, len(ids))
		for i := range idx {
			idx[i] = i
		}
		slices.SortFunc(idx, func(a, b int) int { return int(ids[a]) - int(ids[b]) })
		sortedIDs, sortedVals := make([]uint32, len(ids)), make([]uint32, len(ids))
		for i, j := range idx {
			sortedIDs[i], sortedVals[i] = ids[j], vals[j]
		}
		ids, vals = sortedIDs, sortedVals
	}
	return ids, vals, nil
}

// parseID turns "tt0133093" into 133093.
func parseID(s string) (uint32, bool) {
	if !strings.HasPrefix(s, "tt") {
		return 0, false
	}
	n, err := strconv.ParseUint(s[2:], 10, 32)
	return uint32(n), err == nil && n > 0
}
