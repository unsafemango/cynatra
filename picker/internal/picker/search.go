package picker

import (
	"context"
	"fmt"
	"slices"

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

// Search finds up to limit movies and series by name, best matches first.
func (p *Picker) Search(ctx context.Context, query string, limit int) ([]SearchHit, error) {
	results, err := p.tmdb.SearchMulti(ctx, query)
	if err != nil {
		return nil, err
	}
	return searchHits(results, limit), nil
}

func searchHits(results []tmdb.SearchResult, limit int) []SearchHit {
	hits := []SearchHit{}
	for _, r := range results {
		if h, ok := toHit(r); ok {
			hits = append(hits, h)
			if len(hits) == limit {
				break
			}
		}
	}
	return hits
}

// toHit converts a movie or series result; people and obscure entries with
// neither a poster nor any votes are skipped.
func toHit(r tmdb.SearchResult) (SearchHit, bool) {
	if r.MediaType != "movie" && r.MediaType != "tv" {
		return SearchHit{}, false
	}
	if r.PosterPath == "" && r.VoteCount == 0 {
		return SearchHit{}, false
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
	h.Year = year(date)
	if r.PosterPath != "" {
		h.PosterURL = "https://image.tmdb.org/t/p/w185" + r.PosterPath
	}
	return h, true
}
