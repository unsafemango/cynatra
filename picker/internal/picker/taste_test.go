package picker

import (
	"encoding/json"
	"net/url"
	"slices"
	"testing"

	"github.com/cynatra/picker/internal/tmdb"
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

// firsts counts which title comes first over many shuffles.
func firsts(s *scorer, candidates []tmdb.DiscoverResult) map[int]int {
	count := map[int]int{}
	for range 3000 {
		c := slices.Clone(candidates)
		s.shuffle(c)
		count[c[0].ID]++
	}
	return count
}

func TestShuffleFavoursTaste(t *testing.T) {
	candidates := []tmdb.DiscoverResult{
		{ID: 1, GenreIDs: []int{35}},
		{ID: 2, GenreIDs: []int{18}},
		{ID: 3, GenreIDs: []int{27}},
	}
	s := newScorer(&Taste{Genres: []Weighted[string]{{"Comedy", 3}, {"Horror", -3}}})
	got := firsts(s, candidates)
	// Expected shares are about 87%, 12% and 2%.
	if got[1] < 2400 || got[2] <= got[3] {
		t.Errorf("firsts = %v", got)
	}
	if got[3] == 0 {
		t.Errorf("a disliked genre should still be possible: %v", got)
	}
}

func TestShuffleUsesReleaseDates(t *testing.T) {
	candidates := []tmdb.DiscoverResult{
		{ID: 1, ReleaseDate: "1994-05-01"},
		{ID: 2, FirstAirDate: "2015-05-01"},
	}
	s := newScorer(&Taste{Decades: []Weighted[int]{{1990, 4}, {2010, -4}}})
	if got := firsts(s, candidates); got[1] < 2400 {
		t.Errorf("firsts = %v", got)
	}
}

func TestShuffleWithoutTasteIsEven(t *testing.T) {
	var none *scorer
	got := firsts(none, []tmdb.DiscoverResult{{ID: 1, GenreIDs: []int{35}}, {ID: 2, GenreIDs: []int{27}}})
	if got[1] < 1300 || got[2] < 1300 {
		t.Errorf("firsts = %v", got)
	}
}

func TestPeopleQuery(t *testing.T) {
	s := newScorer(&Taste{People: []Weighted[int]{{10, 0.2}, {20, -1}, {30, 0.9}}})
	q := url.Values{"sort_by": {"popularity.desc"}}
	focused, ok := s.peopleQuery(attempt{"movie", "movie"}, q)
	if !ok || focused.Get("with_people") != "30|10" || focused.Get("sort_by") != "popularity.desc" {
		t.Errorf("focused = %v, %v", focused, ok)
	}
	if q.Has("with_people") {
		t.Error("the original query should be left alone")
	}
	if _, ok := s.peopleQuery(attempt{"series", "tv"}, q); ok {
		t.Error("TMDB can't filter series by people")
	}
	dislikes := newScorer(&Taste{People: []Weighted[int]{{20, -1}}})
	if _, ok := dislikes.peopleQuery(attempt{"movie", "movie"}, q); ok {
		t.Error("nobody liked, nothing to look for")
	}
}
