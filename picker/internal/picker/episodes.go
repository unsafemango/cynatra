package picker

import (
	"cmp"
	"context"
	"errors"
	"slices"
	"sync"

	"github.com/cynatra/picker/internal/tmdb"
)

// Appearance is which episodes or seasons of a series someone's credits cover.
type Appearance struct {
	Episodes []Episode `json:"episodes"` // guest roles: the exact episodes
	Seasons  []int     `json:"seasons"`  // every season involved, ascending
}

type Episode struct {
	Season  int    `json:"season"`
	Number  int    `json:"number"`
	Name    string `json:"name,omitempty"`
	AirDate string `json:"airDate,omitempty"`
}

// MaxCreditsPerLookup caps how many credits one Episodes call fetches.
const MaxCreditsPerLookup = 5

// Episodes looks up the episodes and seasons behind one person's credits on a series.
func (p *Picker) Episodes(ctx context.Context, creditIDs []string) (*Appearance, error) {
	credits := make([]*tmdb.Credit, len(creditIDs))
	errs := make([]error, len(creditIDs))
	var wg sync.WaitGroup
	for i, id := range creditIDs {
		wg.Go(func() {
			credits[i], errs[i] = p.tmdb.Credit(ctx, id)
			// TMDB occasionally lacks a credit it listed; show what the others have.
			if errors.Is(errs[i], tmdb.ErrNotFound) {
				credits[i], errs[i] = &tmdb.Credit{}, nil
			}
		})
	}
	wg.Wait()
	if err := errors.Join(errs...); err != nil {
		return nil, err
	}
	return toAppearance(credits), nil
}

func toAppearance(credits []*tmdb.Credit) *Appearance {
	a := &Appearance{Episodes: []Episode{}, Seasons: []int{}}
	addSeason := func(n int) {
		if n > 0 && !slices.Contains(a.Seasons, n) {
			a.Seasons = append(a.Seasons, n)
		}
	}
	for _, c := range credits {
		for _, e := range c.Media.Episodes {
			ep := Episode{Season: e.SeasonNumber, Number: e.EpisodeNumber, Name: e.Name, AirDate: e.AirDate}
			// An actor who also directed an episode has two credits on it.
			if !slices.ContainsFunc(a.Episodes, func(x Episode) bool { return x.Season == ep.Season && x.Number == ep.Number }) {
				a.Episodes = append(a.Episodes, ep)
			}
			addSeason(e.SeasonNumber)
		}
		for _, s := range c.Media.Seasons {
			addSeason(s.SeasonNumber)
		}
	}
	slices.SortFunc(a.Episodes, func(x, y Episode) int {
		return cmp.Or(cmp.Compare(x.Season, y.Season), cmp.Compare(x.Number, y.Number))
	})
	slices.Sort(a.Seasons)
	return a
}
