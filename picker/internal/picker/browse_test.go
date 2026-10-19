package picker

import (
	"testing"

	"github.com/cynatra/picker/internal/tmdb"
)

func TestBrowseHits(t *testing.T) {
	hits := browseHits(attempt{"series", "tv"}, []tmdb.DiscoverResult{
		{ID: 1396, Name: "Breaking Bad", FirstAirDate: "2008-01-20", PosterPath: "/bb.jpg", VoteCount: 15000},
		{ID: 2, Name: "No poster", VoteCount: 900}, // nothing to show on a poster grid
		{ID: 82728, Name: "Bluey", FirstAirDate: "2018-10-01", PosterPath: "/b.jpg", GenreIDs: []int{16}},
	})
	if len(hits) != 2 {
		t.Fatalf("got %d hits: %+v", len(hits), hits)
	}
	if h := hits[0]; h.ID != "tv:1396" || h.Title != "Breaking Bad" || h.Year != 2008 || h.Kind != "series" {
		t.Errorf("first hit: %+v", h)
	}
	if hits[1].Kind != "animation" {
		t.Errorf("Bluey should be animation: %+v", hits[1])
	}
}

func TestInterleave(t *testing.T) {
	m := []SearchHit{{ID: "movie:1"}, {ID: "movie:2"}, {ID: "movie:3"}}
	s := []SearchHit{{ID: "tv:1"}}
	got := interleave([][]SearchHit{m, s}, 3)
	want := []string{"movie:1", "tv:1", "movie:2"}
	for i, h := range got {
		if h.ID != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
	if len(got) != 3 {
		t.Fatalf("limit not applied: %v", got)
	}
	if all := interleave([][]SearchHit{m, s}, 10); len(all) != 4 {
		t.Errorf("should stop when lists run out: %v", all)
	}
}
