package picker

import (
	"fmt"
	"slices"
)

// Taste is what a user's likes and dislikes say about them, as the gateway
// builds it: a signed weight per genre, decade and person. Positive means they
// lean toward it, negative away.
type Taste struct {
	Genres  []Weighted[string] `json:"genres"`  // TMDB genre names, as on Title.Genres
	Decades []Weighted[int]    `json:"decades"` // 1990, 2000, ...
	People  []Weighted[int]    `json:"people"`  // TMDB person IDs
}

type Weighted[K comparable] struct {
	Key    K       `json:"key"`
	Weight float64 `json:"weight"`
}

// maxTraits caps each list in a taste.
const maxTraits = 20

// normalizeTaste checks a request's taste and drops one with nothing in it.
func normalizeTaste(r *Request) error {
	t := r.Taste
	if t == nil {
		return nil
	}
	if len(t.Genres) > maxTraits || len(t.Decades) > maxTraits || len(t.People) > maxTraits {
		return fmt.Errorf("too many taste traits")
	}
	t.Genres = weighted(t.Genres)
	t.Decades = weighted(t.Decades)
	t.People = weighted(t.People)
	if len(t.Genres)+len(t.Decades)+len(t.People) == 0 {
		r.Taste = nil
	}
	return nil
}

// weighted leaves out traits the user is neutral about.
func weighted[K comparable](ws []Weighted[K]) []Weighted[K] {
	return slices.DeleteFunc(ws, func(w Weighted[K]) bool { return w.Weight == 0 })
}
