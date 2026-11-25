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
