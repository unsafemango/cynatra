package picker

import (
	"cmp"
	"context"
	"fmt"
	"slices"

	"github.com/cynatra/picker/internal/tmdb"
)

// Person is an actor or crew member with their filmography.
type Person struct {
	ID           int      `json:"id"`
	Name         string   `json:"name"`
	Biography    string   `json:"biography,omitempty"`
	Birthday     string   `json:"birthday,omitempty"` // YYYY-MM-DD
	Deathday     string   `json:"deathday,omitempty"`
	PlaceOfBirth string   `json:"placeOfBirth,omitempty"`
	KnownFor     string   `json:"knownFor,omitempty"` // department, e.g. Acting, Directing
	AlsoKnownAs  []string `json:"alsoKnownAs"`
	PhotoURL     string   `json:"photoUrl,omitempty"`
	Homepage     string   `json:"homepage,omitempty"`
	IMDbURL      string   `json:"imdbUrl,omitempty"`
	InstagramURL string   `json:"instagramUrl,omitempty"`
	TMDBURL      string   `json:"tmdbUrl"`
	// Their best-known titles, most voted first.
	KnownForTitles []SearchHit `json:"knownForTitles"`
	// Every movie and series, newest first; undated (upcoming) ones lead.
	Credits []PersonCredit `json:"credits"`
}

// PersonCredit is a title plus what the person did on it.
type PersonCredit struct {
	SearchHit
	Roles    []string `json:"roles"`              // characters played and/or crew jobs
	Episodes int      `json:"episodes,omitempty"` // series they appeared in
	Votes    int      `json:"votes"`              // TMDB vote count, for sorting by popularity
	// Series only: TMDB credit IDs, for looking up which episodes or seasons (see Episodes).
	CreditIDs []string `json:"creditIds,omitempty"`
}

const (
	maxKnownFor    = 8
	maxAlsoKnownAs = 3
)

// Talk and news shows are mostly guest appearances; they'd drown out the real work.
var appearanceGenres = []int{10767, 10763}

// Person fetches someone's details and filmography.
func (p *Picker) Person(ctx context.Context, id int) (*Person, error) {
	d, err := p.tmdb.Person(ctx, id)
	if err != nil {
		return nil, err
	}
	return toPerson(d), nil
}

func toPerson(d *tmdb.Person) *Person {
	out := &Person{
		ID:           d.ID,
		Name:         d.Name,
		Biography:    d.Biography,
		Birthday:     d.Birthday,
		Deathday:     d.Deathday,
		PlaceOfBirth: d.PlaceOfBirth,
		KnownFor:     d.KnownForDepartment,
		AlsoKnownAs:  []string{},
		Homepage:     d.Homepage,
		TMDBURL:      fmt.Sprintf("https://www.themoviedb.org/person/%d", d.ID),
	}
	for _, a := range d.AlsoKnownAs {
		if a != d.Name && len(out.AlsoKnownAs) < maxAlsoKnownAs {
			out.AlsoKnownAs = append(out.AlsoKnownAs, a)
		}
	}
	if d.ProfilePath != "" {
		out.PhotoURL = "https://image.tmdb.org/t/p/w500" + d.ProfilePath
	}
	if d.ExternalIDs.IMDbID != "" {
		out.IMDbURL = "https://www.imdb.com/name/" + d.ExternalIDs.IMDbID
	}
	if d.ExternalIDs.InstagramID != "" {
		out.InstagramURL = "https://www.instagram.com/" + d.ExternalIDs.InstagramID
	}

	// One entry per title, collecting every role (an actor-director gets both).
	byID := map[string]*PersonCredit{}
	var order []string
	add := func(c tmdb.PersonCredit, role string, cast bool) {
		if c.MediaType == "tv" && slices.ContainsFunc(c.GenreIDs, func(g int) bool { return slices.Contains(appearanceGenres, g) }) {
			return
		}
		h, ok := toHit(c.SearchResult)
		if !ok {
			return
		}
		pc := byID[h.ID]
		if pc == nil {
			pc = &PersonCredit{SearchHit: h, Roles: []string{}, Votes: c.VoteCount}
			byID[h.ID] = pc
			order = append(order, h.ID)
		}
		if role != "" && !slices.Contains(pc.Roles, role) {
			pc.Roles = append(pc.Roles, role)
		}
		if cast {
			pc.Episodes += c.EpisodeCount
		}
		if c.MediaType == "tv" && c.CreditID != "" && !slices.Contains(pc.CreditIDs, c.CreditID) {
			pc.CreditIDs = append(pc.CreditIDs, c.CreditID)
		}
	}
	for _, c := range d.CombinedCredits.Cast {
		add(c, c.Character, true)
	}
	for _, c := range d.CombinedCredits.Crew {
		add(c, c.Job, false)
	}

	out.Credits = make([]PersonCredit, 0, len(order))
	for _, id := range order {
		out.Credits = append(out.Credits, *byID[id])
	}
	slices.SortStableFunc(out.Credits, func(a, b PersonCredit) int {
		switch {
		case a.Year == 0 && b.Year != 0:
			return -1 // undated (upcoming) first
		case b.Year == 0 && a.Year != 0:
			return 1
		}
		return cmp.Compare(b.Year, a.Year)
	})

	// Known for: the most voted titles from their main line of work.
	acting := d.KnownForDepartment == "" || d.KnownForDepartment == "Acting"
	main := map[string]bool{}
	source := d.CombinedCredits.Crew
	if acting {
		source = d.CombinedCredits.Cast
	}
	for _, c := range source {
		if h, ok := toHit(c.SearchResult); ok && byID[h.ID] != nil {
			main[h.ID] = true
		}
	}
	known := slices.Clone(order)
	slices.SortStableFunc(known, func(a, b string) int { return cmp.Compare(byID[b].Votes, byID[a].Votes) })
	out.KnownForTitles = []SearchHit{}
	for _, id := range known {
		if c := byID[id]; main[id] && c.PosterURL != "" {
			out.KnownForTitles = append(out.KnownForTitles, c.SearchHit)
			if len(out.KnownForTitles) == maxKnownFor {
				break
			}
		}
	}
	return out
}
