package picker

import (
	"encoding/json"
	"slices"
	"testing"

	"github.com/cynatra/picker/internal/tmdb"
)

func TestToPerson(t *testing.T) {
	var d tmdb.Person
	if err := json.Unmarshal([]byte(`{
		"id": 6384, "name": "Keanu Reeves", "known_for_department": "Acting",
		"birthday": "1964-09-02", "place_of_birth": "Beirut, Lebanon", "profile_path": "/k.jpg",
		"also_known_as": ["Keanu Reeves", "키아누 리브스"],
		"external_ids": {"imdb_id": "nm0000206", "instagram_id": ""},
		"combined_credits": {
			"cast": [
				{"id": 603, "media_type": "movie", "title": "The Matrix", "release_date": "1999-03-31", "poster_path": "/m.jpg", "vote_count": 25000, "character": "Neo"},
				{"id": 245891, "media_type": "movie", "title": "John Wick", "release_date": "2014-10-22", "poster_path": "/j.jpg", "vote_count": 19000, "character": "John Wick"},
				{"id": 1, "media_type": "tv", "name": "Late Show", "first_air_date": "2015-09-08", "poster_path": "/l.jpg", "vote_count": 500, "genre_ids": [10767], "character": "Self"},
				{"id": 999, "media_type": "movie", "title": "Untitled Project", "poster_path": "/u.jpg", "vote_count": 1, "character": "TBA"},
				{"id": 68421, "media_type": "tv", "name": "Swedish Dicks", "first_air_date": "2016-08-14", "poster_path": "/s.jpg", "vote_count": 30, "character": "Tex", "episode_count": 2}
			],
			"crew": [
				{"id": 603, "media_type": "movie", "title": "The Matrix", "release_date": "1999-03-31", "poster_path": "/m.jpg", "vote_count": 25000, "job": "Stunts"},
				{"id": 212, "media_type": "movie", "title": "Man of Tai Chi", "release_date": "2013-07-04", "poster_path": "/t.jpg", "vote_count": 600, "job": "Director"}
			]
		}
	}`), &d); err != nil {
		t.Fatal(err)
	}
	p := toPerson(&d)

	if p.IMDbURL != "https://www.imdb.com/name/nm0000206" || p.InstagramURL != "" || p.PhotoURL == "" {
		t.Errorf("links/photo: %+v", p)
	}
	if !slices.Equal(p.AlsoKnownAs, []string{"키아누 리브스"}) {
		t.Errorf("alsoKnownAs = %v (own name should be dropped)", p.AlsoKnownAs)
	}

	var ids []string
	for _, c := range p.Credits {
		ids = append(ids, c.ID)
	}
	// Undated first, then newest first; the talk show is left out.
	want := []string{"movie:999", "tv:68421", "movie:245891", "movie:212", "movie:603"}
	if !slices.Equal(ids, want) {
		t.Errorf("credits = %v, want %v", ids, want)
	}
	matrix := p.Credits[len(p.Credits)-1]
	if !slices.Equal(matrix.Roles, []string{"Neo", "Stunts"}) {
		t.Errorf("matrix roles = %v", matrix.Roles)
	}
	if p.Credits[1].Episodes != 2 {
		t.Errorf("episodes = %d", p.Credits[1].Episodes)
	}

	// Known for: acting credits only (not the film he directed), most voted first.
	var known []string
	for _, h := range p.KnownForTitles {
		known = append(known, h.ID)
	}
	if !slices.Equal(known[:2], []string{"movie:603", "movie:245891"}) || slices.Contains(known, "movie:212") {
		t.Errorf("knownFor = %v", known)
	}
}
