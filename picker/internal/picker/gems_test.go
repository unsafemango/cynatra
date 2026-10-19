package picker

import (
	"testing"
	"time"

	"github.com/cynatra/picker/internal/imdb"
)

func TestIsGem(t *testing.T) {
	cases := []struct {
		name string
		t    Title
		want bool
	}{
		{"great and little-known movie", Title{MediaType: "movie", IMDb: &imdb.Score{Rating: 7.9, Votes: 9400}}, true},
		{"great but everyone's seen it", Title{MediaType: "movie", IMDb: &imdb.Score{Rating: 8.8, Votes: 2_300_000}}, false},
		{"too few votes to trust", Title{MediaType: "movie", IMDb: &imdb.Score{Rating: 9.4, Votes: 120}}, false},
		{"little-known but only fine", Title{MediaType: "movie", IMDb: &imdb.Score{Rating: 6.8, Votes: 9000}}, false},
		{"series band is lower", Title{MediaType: "tv", IMDb: &imdb.Score{Rating: 8.2, Votes: 30000}}, false},
		{"series gem", Title{MediaType: "tv", IMDb: &imdb.Score{Rating: 8.2, Votes: 4000}}, true},
		{"no IMDb rating: TMDB decides", Title{MediaType: "movie", Rating: 7.6, VoteCount: 600}, true},
		{"no IMDb rating, too popular on TMDB", Title{MediaType: "movie", Rating: 7.6, VoteCount: 20000}, false},
		{"brand new: few ratings only because it just came out", Title{MediaType: "tv", Year: 2026, IMDb: &imdb.Score{Rating: 8.1, Votes: 4175}}, false},
		{"out last year is fine", Title{MediaType: "movie", Year: 2025, IMDb: &imdb.Score{Rating: 7.9, Votes: 9400}}, true},
	}
	now := time.Date(2026, 10, 19, 0, 0, 0, 0, time.UTC)
	for _, c := range cases {
		if c.t.Year == 0 {
			c.t.Year = 2018
		}
		if got := isGemAt(&c.t, now); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestBuildQueryGems(t *testing.T) {
	q, ok := buildQuery(attempt{"movie", "movie"}, Request{Gems: true, MinRating: 6.5})
	if !ok {
		t.Fatal("expected a query")
	}
	if q.Get("vote_count.gte") != "150" || q.Get("vote_count.lte") != "1500" || q.Get("vote_average.gte") != "7.0" {
		t.Errorf("movie gems query: %v", q)
	}
	q, _ = buildQuery(attempt{"series", "tv"}, Request{Gems: true, MinRating: 8})
	if q.Get("vote_count.lte") != "1000" || q.Get("vote_average.gte") != "8.0" {
		t.Errorf("series gems query keeps a higher minimum: %v", q)
	}
}

func TestBuildQueryGemsLeavesOutNewReleases(t *testing.T) {
	q, _ := buildQuery(attempt{"series", "tv"}, Request{Gems: true})
	latest := gemReleasedBefore(time.Now()).Format("2006-01-02")
	if q.Get("first_air_date.lte") != latest {
		t.Errorf("first_air_date.lte = %q, want %q", q.Get("first_air_date.lte"), latest)
	}
	// A year range reaching this year still leaves out the last 12 months.
	q, _ = buildQuery(attempt{"movie", "movie"}, Request{Gems: true, YearFrom: 2020, YearTo: time.Now().Year()})
	if q.Get("primary_release_date.lte") != latest {
		t.Errorf("with YearTo this year: primary_release_date.lte = %q, want %q", q.Get("primary_release_date.lte"), latest)
	}
	// An earlier cap from the year filter stays.
	q, _ = buildQuery(attempt{"movie", "movie"}, Request{Gems: true, YearTo: 1999})
	if q.Get("primary_release_date.lte") != "1999-12-31" {
		t.Errorf("primary_release_date.lte = %q", q.Get("primary_release_date.lte"))
	}
}
