package picker

import (
	"encoding/json"
	"slices"
	"testing"

	"github.com/cynatra/picker/internal/tmdb"
)

func decode(t *testing.T, s string) *tmdb.FullDetails {
	t.Helper()
	var d tmdb.FullDetails
	if err := json.Unmarshal([]byte(s), &d); err != nil {
		t.Fatal(err)
	}
	return &d
}

func TestTitleDetailsMovie(t *testing.T) {
	d := decode(t, `{
		"id": 603, "title": "The Matrix", "original_title": "The Matrix", "original_language": "en",
		"tagline": "Welcome to the Real World.", "status": "Released", "release_date": "1999-03-31",
		"budget": 63000000, "revenue": 463517383,
		"spoken_languages": [{"iso_639_1": "en", "english_name": "English"}],
		"production_countries": [{"name": "United States of America"}],
		"belongs_to_collection": {"name": "The Matrix Collection"},
		"credits": {
			"cast": [{"name": "Keanu Reeves", "character": "Neo", "profile_path": "/k.jpg"}],
			"crew": [
				{"id": 9339, "name": "Lana Wachowski", "job": "Director"},
				{"id": 9340, "name": "Lilly Wachowski", "job": "Director"},
				{"id": 9339, "name": "Lana Wachowski", "job": "Writer"},
				{"id": 1, "name": "Don Davis", "job": "Original Music Composer"},
				{"id": 2, "name": "Someone", "job": "Catering"}
			]
		},
		"release_dates": {"results": [
			{"iso_3166_1": "US", "release_dates": [{"certification": "", "type": 1}, {"certification": "R", "type": 3}]},
			{"iso_3166_1": "DE", "release_dates": [{"certification": "16", "type": 3}]}
		]},
		"keywords": {"keywords": [{"name": "simulated reality"}]},
		"recommendations": {"results": [{"id": 604, "title": "The Matrix Reloaded", "poster_path": "/r.jpg", "vote_count": 9}]},
		"external_ids": {"imdb_id": "tt0133093"}
	}`)

	td := toTitleDetails("movie", d, "GB")
	if td.Certification != "R" {
		t.Errorf("certification = %q, want the US fallback R", td.Certification)
	}
	if toTitleDetails("movie", d, "DE").Certification != "16" {
		t.Error("expected the German rating for DE")
	}
	if td.OriginalTitle != "" {
		t.Errorf("original title should be empty when it matches, got %q", td.OriginalTitle)
	}
	if td.OriginalLanguage != "English" || td.Collection != "The Matrix Collection" || td.Budget != 63000000 {
		t.Errorf("facts: %+v", td)
	}
	if td.IMDbURL != "https://www.imdb.com/title/tt0133093" {
		t.Errorf("imdb = %q", td.IMDbURL)
	}
	want := []CrewGroup{
		{Job: "Director", People: []PersonRef{{9339, "Lana Wachowski"}, {9340, "Lilly Wachowski"}}},
		{Job: "Writer", People: []PersonRef{{9339, "Lana Wachowski"}}},
		{Job: "Original Music Composer", People: []PersonRef{{1, "Don Davis"}}},
	}
	if len(td.Crew) != len(want) {
		t.Fatalf("crew = %+v", td.Crew)
	}
	for i, g := range want {
		if td.Crew[i].Job != g.Job || !slices.Equal(td.Crew[i].People, g.People) {
			t.Errorf("crew[%d] = %+v, want %+v", i, td.Crew[i], g)
		}
	}
	if c := td.Cast[0]; c.Character != "Neo" || c.PhotoURL == "" {
		t.Errorf("cast = %+v", c)
	}
	if len(td.Recommendations) != 1 || td.Recommendations[0].ID != "movie:604" {
		t.Errorf("recommendations = %+v", td.Recommendations)
	}
}

func TestTitleDetailsSeries(t *testing.T) {
	d := decode(t, `{
		"id": 1396, "name": "Breaking Bad", "original_name": "Breaking Bad", "original_language": "en",
		"first_air_date": "2008-01-20", "last_air_date": "2013-09-29", "number_of_episodes": 62,
		"networks": [{"name": "AMC", "logo_path": "/amc.png"}],
		"created_by": [{"id": 66633, "name": "Vince Gilligan"}],
		"seasons": [
			{"season_number": 0, "name": "Specials", "episode_count": 9},
			{"season_number": 1, "name": "Season 1", "episode_count": 7, "air_date": "2008-01-20"}
		],
		"aggregate_credits": {
			"cast": [{"name": "Bryan Cranston", "roles": [{"character": "Walter White"}], "total_episode_count": 62}],
			"crew": [{"id": 66633, "name": "Vince Gilligan", "jobs": [{"job": "Executive Producer"}, {"job": "Writer"}]}]
		},
		"content_ratings": {"results": [{"iso_3166_1": "US", "rating": "TV-MA"}]},
		"keywords": {"results": [{"name": "drug dealer"}]}
	}`)

	td := toTitleDetails("tv", d, "US")
	if td.ReleaseDate != "2008-01-20" || td.LastAirDate != "2013-09-29" || td.Episodes != 62 {
		t.Errorf("dates/episodes: %+v", td)
	}
	if td.Certification != "TV-MA" {
		t.Errorf("certification = %q", td.Certification)
	}
	if len(td.SeasonList) != 1 || td.SeasonList[0].Year != 2008 {
		t.Errorf("seasons (specials skipped) = %+v", td.SeasonList)
	}
	if c := td.Cast[0]; c.Character != "Walter White" || c.Episodes != 62 {
		t.Errorf("cast = %+v", c)
	}
	if len(td.Crew) != 2 || td.Crew[0].Job != "Writer" || td.Crew[1].Job != "Executive Producer" {
		t.Errorf("crew = %+v", td.Crew)
	}
	if !slices.Equal(td.Keywords, []string{"drug dealer"}) || !slices.Equal(td.CreatedBy, []PersonRef{{66633, "Vince Gilligan"}}) {
		t.Errorf("keywords/createdBy: %+v", td)
	}
	if len(td.Networks) != 1 || td.Networks[0].Logo == "" {
		t.Errorf("networks = %+v", td.Networks)
	}
}
