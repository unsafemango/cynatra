package picker

import (
	"context"
	"fmt"
	"net/url"
	"strconv"

	"github.com/cynatra/picker/internal/tmdb"
)

// MaxPopularPages caps how many TMDB pages (20 titles each) one /popular call reads.
const MaxPopularPages = 25

// Popular lists well-known movies or series ("movie" or "tv"), most popular
// first, as title IDs like "movie:550". The web app's sitemap uses it, so
// search engines find the title pages people are most likely to look for.
func (p *Picker) Popular(ctx context.Context, media string, pages int) ([]string, error) {
	ids := []string{}
	seen := map[int]bool{}
	for page := 1; page <= pages; page++ {
		q := url.Values{
			"sort_by":        {"popularity.desc"},
			"vote_count.gte": {"300"}, // enough votes to be a real, findable title
			"include_adult":  {"false"},
			"page":           {strconv.Itoa(page)},
		}
		res, err := p.tmdb.Discover(ctx, media, q)
		if err != nil {
			if len(ids) > 0 {
				break // a partial list is still useful
			}
			return nil, err
		}
		ids = appendPopular(ids, seen, media, res.Results)
		if page >= res.TotalPages {
			break
		}
	}
	return ids, nil
}

// appendPopular adds results with a poster, skipping ones already listed
// (popularity shifts between pages, so a title can appear twice).
func appendPopular(ids []string, seen map[int]bool, media string, results []tmdb.DiscoverResult) []string {
	for _, r := range results {
		if r.PosterPath == "" || seen[r.ID] {
			continue
		}
		seen[r.ID] = true
		ids = append(ids, fmt.Sprintf("%s:%d", media, r.ID))
	}
	return ids
}
