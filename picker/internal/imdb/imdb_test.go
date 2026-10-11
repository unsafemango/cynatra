package imdb

import (
	"strings"
	"testing"
)

func TestParseAndLookup(t *testing.T) {
	// Out of order on purpose, plus a malformed line and a too-big vote count.
	ids, vals, err := Parse(strings.NewReader("tconst\taverageRating\tnumVotes\n" +
		"tt0903747\t9.5\t2300000\n" +
		"tt0133093\t8.7\t2200000\n" +
		"garbage line\n" +
		"tt0000001\t5.7\t2100\n" +
		"tt9999999\t10.0\t99999999\n"))
	if err != nil {
		t.Fatal(err)
	}
	r := &Ratings{ids: ids, vals: vals}

	cases := map[string]Score{
		"tt0133093": {8.7, 2200000},
		"tt0903747": {9.5, 2300000},
		"tt0000001": {5.7, 2100},
		"tt9999999": {10, 1<<voteBits - 1},
	}
	for id, want := range cases {
		if got, ok := r.Lookup(id); !ok || got != want {
			t.Errorf("Lookup(%s) = %+v, %v; want %+v", id, got, ok, want)
		}
	}
	for _, id := range []string{"tt0000002", "nm0000206", "", "tt"} {
		if _, ok := r.Lookup(id); ok {
			t.Errorf("Lookup(%q) found a score", id)
		}
	}
	if !r.Loaded() || (&Ratings{}).Loaded() {
		t.Error("Loaded")
	}
}

func TestParseEmpty(t *testing.T) {
	if _, _, err := Parse(strings.NewReader("tconst\taverageRating\tnumVotes\n")); err == nil {
		t.Error("expected an error for a file with no ratings")
	}
}
