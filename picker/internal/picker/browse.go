package picker

import (
	"context"

	"github.com/cynatra/picker/internal/tmdb"
)

// MaxBrowse caps how many titles one Browse returns.
const MaxBrowse = 40

// Browse lists the most popular titles matching a Spin request (same filters,
// same quality floor), for the web app's landing pages, e.g. "popular horror
// movies on Netflix". Unlike Pick it isn't random: the same request gives the
// same list, so pages are stable for visitors and search engines.
func (p *Picker) Browse(ctx context.Context, r Request, limit int) ([]SearchHit, error) {
	if err := Normalize(&r); err != nil {
		return nil, err
	}
	if len(r.Services) > 0 {
		ids, err := p.providerIDsFor(ctx, r.Services, r.Region)
		if err != nil {
			return nil, err
		}
		r.providerIDs = ids
	}
	var attempts []attempt
	switch r.Type {
	case "movie":
		attempts = []attempt{{"movie", "movie"}}
	case "series":
		attempts = []attempt{{"series", "tv"}}
	case "animation":
		attempts = []attempt{{"animation", "movie"}, {"animation", "tv"}}
	default:
		attempts = []attempt{{"movie", "movie"}, {"series", "tv"}}
	}

	var lists [][]SearchHit
	for _, a := range attempts {
		q, ok := buildQuery(a, r)
		if !ok {
			continue // e.g. horror series: TMDB has no TV horror genre
		}
		page, err := p.tmdb.Discover(ctx, a.media, withPage(q, 1))
		if err != nil {
			return nil, err
		}
		lists = append(lists, browseHits(a, page.Results))
	}
	return interleave(lists, limit), nil
}

// browseHits turns discover results into poster tiles.
func browseHits(a attempt, results []tmdb.DiscoverResult) []SearchHit {
	hits := []SearchHit{}
	for _, r := range results {
		h, ok := toHit(tmdb.SearchResult{
			ID:           r.ID,
			MediaType:    a.media,
			Title:        r.Title,
			Name:         r.Name,
			ReleaseDate:  r.ReleaseDate,
			FirstAirDate: r.FirstAirDate,
			PosterPath:   r.PosterPath,
			GenreIDs:     r.GenreIDs,
			VoteCount:    r.VoteCount,
		})
		if ok && h.PosterURL != "" {
			hits = append(hits, h)
		}
	}
	return hits
}

// interleave takes one from each list in turn (movies, series, movies...),
// skipping repeats, up to limit.
func interleave(lists [][]SearchHit, limit int) []SearchHit {
	out := []SearchHit{}
	seen := map[string]bool{}
	for i := 0; len(out) < limit; i++ {
		added := false
		for _, l := range lists {
			if i < len(l) {
				added = true
				if !seen[l[i].ID] && len(out) < limit {
					seen[l[i].ID] = true
					out = append(out, l[i])
				}
			}
		}
		if !added {
			break
		}
	}
	return out
}
