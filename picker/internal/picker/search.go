package picker

import (
	"context"
	"fmt"
	"slices"
	"strconv"

	"github.com/cynatra/picker/internal/tmdb"
)

// SearchHit is a lightweight title for search results and the shortlist.
type SearchHit struct {
	ID        string `json:"id"` // "movie:123"
	TMDBID    int    `json:"tmdbId"`
	MediaType string `json:"mediaType"`
	Kind      string `json:"kind"` // movie | series | animation
	Title     string `json:"title"`
	Year      int    `json:"year,omitempty"`
	PosterURL string `json:"posterUrl,omitempty"`
}

const maxSearchHits = 8

// Search finds movies and series by name, best matches first.
func (p *Picker) Search(ctx context.Context, query string) ([]SearchHit, error) {
	results, err := p.tmdb.SearchMulti(ctx, query)
	if err != nil {
		return nil, err
	}
	return searchHits(results), nil
}

func searchHits(results []tmdb.SearchResult) []SearchHit {
	hits := []SearchHit{}
	for _, r := range results {
		if r.MediaType != "movie" && r.MediaType != "tv" {
			continue // people
		}
		// Skip obscure entries with neither a poster nor any votes.
		if r.PosterPath == "" && r.VoteCount == 0 {
			continue
		}
		h := SearchHit{
			ID:        fmt.Sprintf("%s:%d", r.MediaType, r.ID),
			TMDBID:    r.ID,
			MediaType: r.MediaType,
			Kind:      "movie",
			Title:     r.Title,
		}
		date := r.ReleaseDate
		if r.MediaType == "tv" {
			h.Kind, h.Title, date = "series", r.Name, r.FirstAirDate
		}
		if slices.Contains(r.GenreIDs, animationGenreID) {
			h.Kind = "animation"
		}
		if len(date) >= 4 {
			h.Year, _ = strconv.Atoi(date[:4])
		}
		if r.PosterPath != "" {
			h.PosterURL = "https://image.tmdb.org/t/p/w185" + r.PosterPath
		}
		hits = append(hits, h)
		if len(hits) == maxSearchHits {
			break
		}
	}
	return hits
}
