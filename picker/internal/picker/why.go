package picker

import (
	"cmp"
	"context"
	"slices"
)

// Why says what a title has in common with the viewer's likes.
type Why struct {
	People []string `json:"people,omitempty"` // liked people who made it or lead its cast
	Genres []string `json:"genres,omitempty"` // as on Title.Genres, best liked first
	Decade int      `json:"decade,omitempty"` // 1990, 2000, ...
}

// A reason is one short line, so it names only the strongest few.
const (
	maxWhyPeople = 2
	maxWhyGenres = 2
)

// explain says why a pick fits the taste, or nil when there's no good reason:
// nothing liked about it, or more disliked than liked.
func (p *Picker) explain(ctx context.Context, a attempt, r Request, t *Title) *Why {
	s := r.scorer
	if s == nil {
		return nil
	}
	why := &Why{}
	if len(s.liked) > 0 {
		// Without the credits there's still genres and decade to go on.
		if d, err := p.tmdb.FullDetails(ctx, a.media, t.TMDBID); err == nil {
			why.People = s.likedNames(leadPeople(a.media, d))
		}
	}
	var ids []int
	for _, name := range t.Genres {
		if id, ok := tmdbGenreIDs[name]; ok {
			ids = append(ids, id)
		}
	}
	if len(why.People) == 0 && s.score(ids, t.Year) <= 0 {
		return nil
	}
	why.Genres = s.likedGenres(t.Genres)
	if t.Year > 0 && s.decades[t.Year/10*10] > 0 {
		why.Decade = t.Year / 10 * 10
	}
	if len(why.People)+len(why.Genres) == 0 && why.Decade == 0 {
		return nil
	}
	return why
}

// likedNames picks the liked people out of a title's credits, strongest first.
func (s *scorer) likedNames(people []PersonRef) []string {
	var names []string
	for _, id := range s.liked {
		i := slices.IndexFunc(people, func(p PersonRef) bool { return p.ID == id })
		if i >= 0 && people[i].Name != "" && len(names) < maxWhyPeople {
			names = append(names, people[i].Name)
		}
	}
	return names
}

// likedGenres is the title's genres the user leans toward, best liked first.
func (s *scorer) likedGenres(genres []string) []string {
	weight := map[string]float64{}
	var liked []string
	for _, name := range genres {
		id, ok := tmdbGenreIDs[name]
		if !ok {
			continue
		}
		if w := s.score([]int{id}, 0); w > 0 {
			weight[name] = w
			liked = append(liked, name)
		}
	}
	slices.SortStableFunc(liked, func(a, b string) int { return cmp.Compare(weight[b], weight[a]) })
	return liked[:min(maxWhyGenres, len(liked))]
}
