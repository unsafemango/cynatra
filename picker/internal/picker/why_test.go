package picker

import (
	"context"
	"reflect"
	"strings"
	"testing"
)

// A 1990s comedy drama directed by person 100.
func oneMovie(key string) string {
	if strings.HasPrefix(key, "tmdb:/discover/") {
		return `{"total_pages": 1, "total_results": 1, "results": [{"id": 1, "genre_ids": [18, 35]}]}`
	}
	return `{"id": 1, "release_date": "1994-05-01",
		"genres": [{"id": 18, "name": "Drama"}, {"id": 35, "name": "Comedy"}],
		"credits": {"crew": [{"id": 100, "name": "Ada", "job": "Director"}]}}`
}

func pickWhy(t *testing.T, f fakeTMDB, taste *Taste) *Why {
	t.Helper()
	title, err := fakePicker(f).Pick(context.Background(), Request{Type: "movie", Taste: taste})
	if err != nil {
		t.Fatal(err)
	}
	return title.Why
}

func TestPickSaysWhy(t *testing.T) {
	got := pickWhy(t, oneMovie, &Taste{
		Genres:  []Weighted[string]{{"Drama", 1}, {"Comedy", 2}},
		Decades: []Weighted[int]{{1990, 1}},
		People:  []Weighted[int]{{100, 1}},
	})
	want := &Why{People: []string{"Ada"}, Genres: []string{"Comedy", "Drama"}, Decade: 1990}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("why = %+v", got)
	}
}

func TestWhyLeavesOutDislikedTraits(t *testing.T) {
	got := pickWhy(t, oneMovie, &Taste{
		Genres:  []Weighted[string]{{"Comedy", 4}, {"Drama", -1}},
		Decades: []Weighted[int]{{1990, -0.2}},
	})
	// A match on comedy: drama and the decade aren't reasons.
	if want := (&Why{Genres: []string{"Comedy"}}); !reflect.DeepEqual(got, want) {
		t.Errorf("why = %+v", got)
	}
}

func TestNoWhyForAPoorMatch(t *testing.T) {
	got := pickWhy(t, oneMovie, &Taste{
		Genres: []Weighted[string]{{"Comedy", 1}, {"Drama", -2}},
	})
	if got != nil {
		t.Errorf("why = %+v", got)
	}
}

func TestNoWhyWithoutATaste(t *testing.T) {
	if got := pickWhy(t, oneMovie, nil); got != nil {
		t.Errorf("why = %+v", got)
	}
}

func TestWhyNamesLikedPeopleDespiteGenres(t *testing.T) {
	got := pickWhy(t, oneMovie, &Taste{
		Genres: []Weighted[string]{{"Drama", -2}},
		People: []Weighted[int]{{100, 1}},
	})
	if got == nil || len(got.People) != 1 || got.Genres != nil {
		t.Errorf("why = %+v", got)
	}
}
