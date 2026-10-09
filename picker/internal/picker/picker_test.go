package picker

import "testing"

func TestBuildQueryMovieGenresAreORed(t *testing.T) {
	q, ok := buildQuery(attempt{"movie", "movie"}, Request{Genres: []string{"comedy", "horror"}, MinRating: 7})
	if !ok {
		t.Fatal("expected query")
	}
	if got := q.Get("with_genres"); got != "35|27" {
		t.Errorf("with_genres = %q", got)
	}
	if got := q.Get("without_genres"); got != "16" {
		t.Errorf("without_genres = %q", got)
	}
	if got := q.Get("vote_average.gte"); got != "7.0" {
		t.Errorf("vote_average.gte = %q", got)
	}
}

func TestBuildQueryUnsupportedTVGenre(t *testing.T) {
	if _, ok := buildQuery(attempt{"series", "tv"}, Request{Genres: []string{"horror"}}); ok {
		t.Error("horror has no TV genre; expected no query")
	}
}

func TestBuildQueryAnimationRequiresAnimationGenre(t *testing.T) {
	q, _ := buildQuery(attempt{"animation", "tv"}, Request{Genres: []string{"scifi"}, YearFrom: 2000})
	if got := q.Get("with_genres"); got != "16,10765" {
		t.Errorf("with_genres = %q", got)
	}
	if got := q.Get("first_air_date.gte"); got != "2000-01-01" {
		t.Errorf("first_air_date.gte = %q", got)
	}
}

func TestNormalize(t *testing.T) {
	r := Request{Type: "Surprise"}
	if err := Normalize(&r); err != nil || r.Type != "any" || r.Region != "US" {
		t.Errorf("got %+v, %v", r, err)
	}
	if err := Normalize(&Request{Type: "podcast"}); err == nil {
		t.Error("expected error for unknown type")
	}
}

func TestNormalizeSwapsReversedYears(t *testing.T) {
	r := Request{YearFrom: 2010, YearTo: 1990}
	if err := Normalize(&r); err != nil || r.YearFrom != 1990 || r.YearTo != 2010 {
		t.Errorf("got %d-%d, %v", r.YearFrom, r.YearTo, err)
	}
}

func TestBuildQuerySingleYear(t *testing.T) {
	q, _ := buildQuery(attempt{"movie", "movie"}, Request{YearFrom: 1999, YearTo: 1999})
	if q.Get("primary_release_date.gte") != "1999-01-01" || q.Get("primary_release_date.lte") != "1999-12-31" {
		t.Errorf("got %v", q)
	}
}

func TestNormalizeLook(t *testing.T) {
	for in, want := range map[string]string{"": "any", "any": "any", "colorful": "colorful", "colourful": "colorful"} {
		r := Request{Look: in}
		if err := Normalize(&r); err != nil || r.Look != want {
			t.Errorf("look %q: got %q, %v", in, r.Look, err)
		}
	}
	if err := Normalize(&Request{Look: "neon"}); err == nil {
		t.Error("expected error for unknown look")
	}
}

func TestColorfulLookExcludesDarkGenresUnlessChosen(t *testing.T) {
	q, _ := buildQuery(attempt{"movie", "movie"}, Request{Look: "colorful"})
	if got := q.Get("without_genres"); got != "16,80,53,27,10752" {
		t.Errorf("without_genres = %q", got)
	}
	q, _ = buildQuery(attempt{"movie", "movie"}, Request{Look: "colorful", Genres: []string{"crime"}})
	if got := q.Get("without_genres"); got != "16,53,27,10752" {
		t.Errorf("chosen crime should stay allowed: without_genres = %q", got)
	}
	q, _ = buildQuery(attempt{"animation", "tv"}, Request{Look: "colorful"})
	if got := q.Get("without_genres"); got != "80,10768" {
		t.Errorf("animated series: without_genres = %q", got)
	}
	q, _ = buildQuery(attempt{"movie", "movie"}, Request{Look: "any"})
	if got := q.Get("without_genres"); got != "16" {
		t.Errorf("any look: without_genres = %q", got)
	}
}
