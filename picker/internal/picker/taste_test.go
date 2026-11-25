package picker

import (
	"encoding/json"
	"testing"
)

func TestNormalizeTaste(t *testing.T) {
	// The shape of the gateway's profile, extra fields and all.
	var r Request
	body := `{"taste": {"ratings": 3,
		"genres": [{"key": "Comedy", "weight": 1.5, "count": 2}, {"key": "Drama", "weight": 0, "count": 2}],
		"decades": [{"key": 1990, "weight": -1, "count": 1}],
		"people": [{"key": 525, "name": "Christopher Nolan", "weight": 0.5, "count": 1}]}}`
	if err := json.Unmarshal([]byte(body), &r); err != nil {
		t.Fatal(err)
	}
	if err := Normalize(&r); err != nil {
		t.Fatal(err)
	}
	if len(r.Taste.Genres) != 1 || r.Taste.Genres[0].Key != "Comedy" {
		t.Errorf("neutral genres should be dropped: %+v", r.Taste.Genres)
	}
	if r.Taste.Decades[0].Key != 1990 || r.Taste.People[0].Key != 525 {
		t.Errorf("taste = %+v", r.Taste)
	}
}

func TestNormalizeEmptyTaste(t *testing.T) {
	r := Request{Taste: &Taste{Genres: []Weighted[string]{{"Drama", 0}}}}
	if err := Normalize(&r); err != nil || r.Taste != nil {
		t.Errorf("a taste with nothing in it should be dropped: %+v, %v", r.Taste, err)
	}
}

func TestNormalizeTasteTooBig(t *testing.T) {
	r := Request{Taste: &Taste{People: make([]Weighted[int], maxTraits+1)}}
	if err := Normalize(&r); err == nil {
		t.Error("expected error for an oversized taste")
	}
}

func TestScoreGenresAndDecades(t *testing.T) {
	s := newScorer(&Taste{
		Genres:  []Weighted[string]{{"Comedy", 3}, {"Horror", -3}},
		Decades: []Weighted[int]{{1990, 4}, {2010, -4}},
	})
	comedy, horror, drama := []int{35}, []int{27}, []int{18}
	if got := s.score(comedy, 0); got != 1 {
		t.Errorf("comedy = %v", got)
	}
	if got := s.score(horror, 0); got != -1 {
		t.Errorf("horror = %v", got)
	}
	if got := s.score(drama, 0); got != 0 {
		t.Errorf("drama = %v", got)
	}
	if got := s.score([]int{35, 18}, 0); got != 0.5 {
		t.Errorf("half comedy = %v", got)
	}
	if got := s.score(drama, 1994); got != decadeShare {
		t.Errorf("90s drama = %v", got)
	}
	if got := s.score(comedy, 2015); got != 1-decadeShare {
		t.Errorf("2010s comedy = %v", got)
	}
}

func TestScoreCrossesMovieAndSeriesGenres(t *testing.T) {
	s := newScorer(&Taste{Genres: []Weighted[string]{{"Science Fiction", 4}}})
	if s.score([]int{10765}, 0) <= 0 {
		t.Error("liking sci-fi movies should count toward Sci-Fi & Fantasy series")
	}
	s = newScorer(&Taste{Genres: []Weighted[string]{{"Action & Adventure", -4}, {"Reality", -4}}})
	if s.score([]int{28}, 0) >= 0 || s.score([]int{10764}, 0) >= 0 {
		t.Error("expected action movies and reality series to score below 0")
	}
}

func TestOneRatingCountsForLess(t *testing.T) {
	one := newScorer(&Taste{Genres: []Weighted[string]{{"Comedy", 1}}})
	if got := one.score([]int{35}, 0); got != 1/minScale {
		t.Errorf("score = %v", got)
	}
}

func TestEveryFilterGenreHasATMDBName(t *testing.T) {
	known := map[int]bool{}
	for _, id := range tmdbGenreIDs {
		known[id] = true
	}
	for _, g := range Genres {
		if !known[g.Movie] || (g.TV != 0 && !known[g.TV]) {
			t.Errorf("%s: no TMDB name", g.Slug)
		}
	}
}
