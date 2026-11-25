package picker

import (
	"context"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/cynatra/picker/internal/tmdb"
)

// fakeTMDB stands in for the client's cache and answers every request from a
// function, so a whole spin runs without the network.
type fakeTMDB func(key string) string

func (f fakeTMDB) Get(_ context.Context, key string) ([]byte, bool)   { return []byte(f(key)), true }
func (f fakeTMDB) Set(context.Context, string, []byte, time.Duration) {}

func fakePicker(f fakeTMDB) *Picker { return New(tmdb.NewClient("test", f), nil, nil) }

// Movie 1 is a comedy directed by person 100; movie 2 is a horror movie
// directed by person 200. Only movie 1 turns up when searching by people.
func twoMovies(key string) string {
	switch {
	case strings.HasPrefix(key, "tmdb:/discover/") && strings.Contains(key, "with_people"):
		return `{"total_pages": 1, "total_results": 1, "results": [{"id": 1, "genre_ids": [35]}]}`
	case strings.HasPrefix(key, "tmdb:/discover/"):
		return `{"total_pages": 1, "total_results": 2, "results": [{"id": 1, "genre_ids": [35]}, {"id": 2, "genre_ids": [27]}]}`
	}
	id := 1
	if strings.HasPrefix(key, "tmdb:/movie/2?") {
		id = 2
	}
	return `{"id": ` + strconv.Itoa(id) + `, "credits": {"crew": [{"id": ` + strconv.Itoa(id*100) + `, "job": "Director"}]}}`
}

func spins(t *testing.T, p *Picker, r Request) map[string]int {
	t.Helper()
	count := map[string]int{}
	for range 400 {
		title, err := p.Pick(context.Background(), r)
		if err != nil {
			t.Fatal(err)
		}
		count[title.ID]++
	}
	return count
}

func TestPickLeansTowardLikedGenres(t *testing.T) {
	got := spins(t, fakePicker(twoMovies), Request{Type: "movie", Taste: &Taste{
		Genres: []Weighted[string]{{"Comedy", 1}, {"Horror", -1}},
	}})
	// About 88% comedy.
	if got["movie:1"] < 300 || got["movie:2"] == 0 {
		t.Errorf("picks = %v", got)
	}
}

func TestPickSometimesSearchesByLikedPeople(t *testing.T) {
	searched := 0
	p := fakePicker(func(key string) string {
		if strings.Contains(key, "with_people=100") {
			searched++
		}
		return twoMovies(key)
	})
	spins(t, p, Request{Type: "movie", Taste: &Taste{People: []Weighted[int]{{100, 1}}}})
	// About a quarter of 400.
	if searched < 50 || searched > 160 {
		t.Errorf("searched by people %d times", searched)
	}
}

func TestPickFallsBackWhenLikedPeopleHaveNothing(t *testing.T) {
	p := fakePicker(func(key string) string {
		if strings.Contains(key, "with_people") {
			return `{"total_pages": 0, "total_results": 0, "results": []}`
		}
		return twoMovies(key)
	})
	spins(t, p, Request{Type: "movie", Taste: &Taste{People: []Weighted[int]{{999, 1}}}})
}

func TestPickAvoidsDislikedPeople(t *testing.T) {
	got := spins(t, fakePicker(twoMovies), Request{Type: "movie", Taste: &Taste{
		People: []Weighted[int]{{200, -1}},
	}})
	if got["movie:2"] != 0 {
		t.Errorf("picks = %v", got)
	}
}

func TestPickStillReturnsADislikedTitleIfItIsAllThereIs(t *testing.T) {
	got := spins(t, fakePicker(twoMovies), Request{
		Type:       "movie",
		ExcludeIDs: []string{"movie:1"},
		Taste:      &Taste{People: []Weighted[int]{{200, -1}}},
	})
	if got["movie:2"] != 400 {
		t.Errorf("picks = %v", got)
	}
}
