package picker

import (
	"encoding/json"
	"slices"
	"testing"

	"github.com/cynatra/picker/internal/tmdb"
)

func TestToAppearance(t *testing.T) {
	var guest, director, regular tmdb.Credit
	for s, c := range map[string]*tmdb.Credit{
		// Guest voice role in one episode...
		`{"media": {"episodes": [{"season_number": 36, "episode_number": 1, "name": "Bart's Birthday", "air_date": "2024-09-29"}]}}`: &guest,
		// ...the same episode again as director, plus an earlier one.
		`{"media": {"episodes": [{"season_number": 36, "episode_number": 1}, {"season_number": 35, "episode_number": 7}]}}`: &director,
		// Regular roles list seasons, not episodes.
		`{"media": {"seasons": [{"season_number": 2}, {"season_number": 1}]}}`: &regular,
	} {
		if err := json.Unmarshal([]byte(s), c); err != nil {
			t.Fatal(err)
		}
	}

	a := toAppearance([]*tmdb.Credit{&guest, &director})
	if len(a.Episodes) != 2 || a.Episodes[0] != (Episode{35, 7, "", ""}) || a.Episodes[1].Name != "Bart's Birthday" {
		t.Errorf("episodes = %+v (want deduped, in order)", a.Episodes)
	}
	if !slices.Equal(a.Seasons, []int{35, 36}) {
		t.Errorf("seasons = %v", a.Seasons)
	}

	r := toAppearance([]*tmdb.Credit{&regular})
	if len(r.Episodes) != 0 || !slices.Equal(r.Seasons, []int{1, 2}) {
		t.Errorf("regular = %+v", r)
	}
}
