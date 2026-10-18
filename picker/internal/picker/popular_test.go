package picker

import (
	"reflect"
	"testing"

	"github.com/cynatra/picker/internal/tmdb"
)

func TestAppendPopular(t *testing.T) {
	seen := map[int]bool{}
	ids := appendPopular(nil, seen, "movie", []tmdb.DiscoverResult{
		{ID: 550, PosterPath: "/f.jpg"},
		{ID: 1, PosterPath: ""}, // no poster: no page worth listing
		{ID: 603, PosterPath: "/m.jpg"},
	})
	// The next page repeats a title that moved down the popularity list.
	ids = appendPopular(ids, seen, "movie", []tmdb.DiscoverResult{{ID: 603, PosterPath: "/m.jpg"}, {ID: 680, PosterPath: "/p.jpg"}})
	want := []string{"movie:550", "movie:603", "movie:680"}
	if !reflect.DeepEqual(ids, want) {
		t.Errorf("got %v, want %v", ids, want)
	}
}

func TestAppendPeople(t *testing.T) {
	seen := map[int]bool{}
	ids := appendPeople(nil, seen, []tmdb.PopularPerson{
		{ID: 287, ProfilePath: "/b.jpg"},
		{ID: 2, ProfilePath: ""},                    // no photo
		{ID: 3, ProfilePath: "/x.jpg", Adult: true}, // never listed
		{ID: 287, ProfilePath: "/b.jpg"},            // repeated
		{ID: 1245, ProfilePath: "/s.jpg"},
	})
	if want := []string{"287", "1245"}; !reflect.DeepEqual(ids, want) {
		t.Errorf("got %v, want %v", ids, want)
	}
}
