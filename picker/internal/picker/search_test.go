package picker

import (
	"testing"

	"github.com/cynatra/picker/internal/tmdb"
)

func TestSearchHits(t *testing.T) {
	hits := searchHits([]tmdb.SearchResult{
		{ID: 1, MediaType: "person", Name: "Someone"},
		{ID: 346648, MediaType: "movie", Title: "Paddington 2", ReleaseDate: "2017-11-09", PosterPath: "/p.jpg", VoteCount: 3000},
		{ID: 82728, MediaType: "tv", Name: "Bluey", FirstAirDate: "2018-10-01", PosterPath: "/b.jpg", GenreIDs: []int{16, 10751}},
		{ID: 9, MediaType: "movie", Title: "Obscure"}, // no poster, no votes
	}, 8)
	if len(hits) != 2 {
		t.Fatalf("got %d hits: %+v", len(hits), hits)
	}
	if h := hits[0]; h.ID != "movie:346648" || h.Kind != "movie" || h.Year != 2017 || h.PosterURL == "" {
		t.Errorf("movie hit: %+v", h)
	}
	if h := hits[1]; h.ID != "tv:82728" || h.Kind != "animation" || h.Title != "Bluey" || h.Year != 2018 {
		t.Errorf("series hit: %+v", h)
	}
}
