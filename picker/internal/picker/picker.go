// Package picker turns a set of filters into one random TMDB title.
package picker

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/url"
	"strconv"
	"strings"

	"github.com/cynatra/picker/internal/tmdb"
)

// TMDB only serves the first 500 pages of discover; we stay well under that
// so picks lean toward titles people have actually heard of.
const maxPages = 100

var ErrNoMatch = errors.New("no titles match these filters")

type Request struct {
	Type       string   `json:"type"` // movie | series | animation | any
	Genres     []string `json:"genres"`
	MinRating  float64  `json:"minRating"`
	YearFrom   int      `json:"yearFrom"`
	YearTo     int      `json:"yearTo"`
	MaxRuntime int      `json:"maxRuntime"` // minutes
	Language   string   `json:"language"`   // ISO 639-1, e.g. "en"
	Region     string   `json:"region"`     // ISO 3166-1, for where-to-watch
	ExcludeIDs []string `json:"excludeIds"` // "movie:123", "tv:456"
}

type Provider struct {
	Name string `json:"name"`
	Logo string `json:"logo"`
}

type WhereToWatch struct {
	Link   string     `json:"link"`
	Stream []Provider `json:"stream"`
	Rent   []Provider `json:"rent"`
	Buy    []Provider `json:"buy"`
}

type Title struct {
	ID           string        `json:"id"` // "movie:123"
	TMDBID       int           `json:"tmdbId"`
	MediaType    string        `json:"mediaType"` // movie | tv
	Kind         string        `json:"kind"`      // movie | series | animation
	Title        string        `json:"title"`
	Overview     string        `json:"overview"`
	PosterURL    string        `json:"posterUrl,omitempty"`
	BackdropURL  string        `json:"backdropUrl,omitempty"`
	Rating       float64       `json:"rating"`
	VoteCount    int           `json:"voteCount"`
	Year         int           `json:"year,omitempty"`
	Runtime      int           `json:"runtime,omitempty"` // minutes (per episode for series)
	Seasons      int           `json:"seasons,omitempty"`
	Genres       []string      `json:"genres"`
	TrailerKey   string        `json:"trailerKey,omitempty"` // YouTube video ID
	TMDBURL      string        `json:"tmdbUrl"`
	WhereToWatch *WhereToWatch `json:"whereToWatch,omitempty"`
}

type Picker struct{ tmdb *tmdb.Client }

func New(c *tmdb.Client) *Picker { return &Picker{tmdb: c} }

type attempt struct{ kind, media string }

func Normalize(r *Request) error {
	r.Type = strings.ToLower(strings.TrimSpace(r.Type))
	switch r.Type {
	case "", "any", "surprise":
		r.Type = "any"
	case "movie", "series", "animation":
	default:
		return fmt.Errorf("unknown type %q", r.Type)
	}
	if r.MinRating < 0 || r.MinRating > 10 {
		return fmt.Errorf("minRating must be between 0 and 10")
	}
	if r.YearFrom > 0 && r.YearTo > 0 && r.YearFrom > r.YearTo {
		r.YearFrom, r.YearTo = r.YearTo, r.YearFrom
	}
	if r.Region == "" {
		r.Region = "US"
	}
	r.Region = strings.ToUpper(r.Region)
	return nil
}

// Pick returns one random title. For "any" and "animation", it tries each
// eligible kind/media combination in random order until one has results.
func (p *Picker) Pick(ctx context.Context, r Request) (*Title, error) {
	if err := Normalize(&r); err != nil {
		return nil, err
	}
	excluded := make(map[string]bool, len(r.ExcludeIDs))
	for _, id := range r.ExcludeIDs {
		excluded[id] = true
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
		attempts = []attempt{{"movie", "movie"}, {"series", "tv"}, {"animation", "movie"}, {"animation", "tv"}}
	}
	rand.Shuffle(len(attempts), func(i, j int) { attempts[i], attempts[j] = attempts[j], attempts[i] })

	for _, a := range attempts {
		t, err := p.pickFrom(ctx, a, r, excluded)
		if errors.Is(err, ErrNoMatch) {
			continue
		}
		return t, err
	}
	return nil, ErrNoMatch
}

func (p *Picker) pickFrom(ctx context.Context, a attempt, r Request, excluded map[string]bool) (*Title, error) {
	q, ok := buildQuery(a, r)
	if !ok {
		return nil, ErrNoMatch
	}

	first, err := p.tmdb.Discover(ctx, a.media, withPage(q, 1))
	if err != nil {
		return nil, err
	}
	if first.TotalResults == 0 {
		return nil, ErrNoMatch
	}
	pages := min(first.TotalPages, maxPages)

	// Sample a few random pages; fall back to scanning in order if the user
	// has excluded most of a small result set.
	tried := map[int]bool{}
	for i := 0; i < 5 && len(tried) < pages; i++ {
		n := rand.IntN(pages) + 1
		if tried[n] {
			continue
		}
		tried[n] = true
		if id, ok, err := p.randomFromPage(ctx, a.media, q, n, first, excluded); err != nil {
			return nil, err
		} else if ok {
			return p.details(ctx, a, id, r.Region)
		}
	}
	for n := 1; n <= pages; n++ {
		if tried[n] {
			continue
		}
		if id, ok, err := p.randomFromPage(ctx, a.media, q, n, first, excluded); err != nil {
			return nil, err
		} else if ok {
			return p.details(ctx, a, id, r.Region)
		}
	}
	return nil, ErrNoMatch
}

func (p *Picker) randomFromPage(ctx context.Context, media string, q url.Values, n int, first *tmdb.DiscoverPage, excluded map[string]bool) (int, bool, error) {
	page := first
	if n != 1 {
		var err error
		if page, err = p.tmdb.Discover(ctx, media, withPage(q, n)); err != nil {
			return 0, false, err
		}
	}
	var ids []int
	for _, res := range page.Results {
		if !excluded[fmt.Sprintf("%s:%d", media, res.ID)] {
			ids = append(ids, res.ID)
		}
	}
	if len(ids) == 0 {
		return 0, false, nil
	}
	return ids[rand.IntN(len(ids))], true, nil
}

func buildQuery(a attempt, r Request) (url.Values, bool) {
	q := url.Values{
		"sort_by":       {"popularity.desc"},
		"include_adult": {"false"},
	}

	ids := genreIDs(r.Genres, a.media)
	if len(r.Genres) > 0 && len(ids) == 0 {
		return nil, false // e.g. horror series: TMDB has no TV horror genre
	}
	if a.kind == "animation" {
		g := strconv.Itoa(animationGenreID)
		if len(ids) > 0 {
			// TMDB can't express "animation AND (x OR y)", so pick one of x/y.
			g += "," + strconv.Itoa(ids[rand.IntN(len(ids))])
		}
		q.Set("with_genres", g)
	} else {
		if len(ids) > 0 {
			parts := make([]string, len(ids))
			for i, id := range ids {
				parts[i] = strconv.Itoa(id)
			}
			q.Set("with_genres", strings.Join(parts, "|")) // | = OR
		}
		q.Set("without_genres", strconv.Itoa(animationGenreID))
	}

	if r.MinRating > 0 {
		q.Set("vote_average.gte", strconv.FormatFloat(r.MinRating, 'f', 1, 64))
	}
	// Without a vote floor, obscure titles with three 10/10 votes dominate.
	minVotes := "150"
	if a.media == "tv" {
		minVotes = "80"
	}
	q.Set("vote_count.gte", minVotes)

	dateField := "primary_release_date"
	if a.media == "tv" {
		dateField = "first_air_date"
	}
	if r.YearFrom > 0 {
		q.Set(dateField+".gte", fmt.Sprintf("%d-01-01", r.YearFrom))
	}
	if r.YearTo > 0 {
		q.Set(dateField+".lte", fmt.Sprintf("%d-12-31", r.YearTo))
	}
	if r.MaxRuntime > 0 {
		q.Set("with_runtime.lte", strconv.Itoa(r.MaxRuntime))
	}
	if r.Language != "" {
		q.Set("with_original_language", strings.ToLower(r.Language))
	}
	return q, true
}

func withPage(q url.Values, n int) url.Values {
	out := url.Values{}
	for k, v := range q {
		out[k] = v
	}
	out.Set("page", strconv.Itoa(n))
	return out
}

// Lookup fetches a single title, e.g. for a shared link.
func (p *Picker) Lookup(ctx context.Context, media string, id int, region string) (*Title, error) {
	kind := "movie"
	if media == "tv" {
		kind = "series"
	}
	t, err := p.details(ctx, attempt{kind, media}, id, strings.ToUpper(region))
	if err != nil {
		return nil, err
	}
	for _, g := range t.Genres {
		if g == "Animation" {
			t.Kind = "animation"
		}
	}
	return t, nil
}

func (p *Picker) details(ctx context.Context, a attempt, id int, region string) (*Title, error) {
	d, err := p.tmdb.Details(ctx, a.media, id)
	if err != nil {
		return nil, err
	}
	t := &Title{
		ID:        fmt.Sprintf("%s:%d", a.media, d.ID),
		TMDBID:    d.ID,
		MediaType: a.media,
		Kind:      a.kind,
		Title:     d.Title,
		Overview:  d.Overview,
		Rating:    d.VoteAverage,
		VoteCount: d.VoteCount,
		Runtime:   d.Runtime,
		Seasons:   d.NumberOfSeasons,
		Genres:    []string{},
		TMDBURL:   fmt.Sprintf("https://www.themoviedb.org/%s/%d", a.media, d.ID),
	}
	date := d.ReleaseDate
	if a.media == "tv" {
		t.Title = d.Name
		date = d.FirstAirDate
		if len(d.EpisodeRunTime) > 0 {
			t.Runtime = d.EpisodeRunTime[0]
		}
	}
	if len(date) >= 4 {
		t.Year, _ = strconv.Atoi(date[:4])
	}
	if d.PosterPath != "" {
		t.PosterURL = "https://image.tmdb.org/t/p/w500" + d.PosterPath
	}
	if d.BackdropPath != "" {
		t.BackdropURL = "https://image.tmdb.org/t/p/w1280" + d.BackdropPath
	}
	for _, g := range d.Genres {
		t.Genres = append(t.Genres, g.Name)
	}
	t.TrailerKey = pickTrailer(d.Videos.Results)
	if rp, ok := d.WatchProviders.Results[region]; ok {
		t.WhereToWatch = &WhereToWatch{
			Link:   rp.Link,
			Stream: toProviders(rp.Flatrate),
			Rent:   toProviders(rp.Rent),
			Buy:    toProviders(rp.Buy),
		}
	}
	return t, nil
}

func pickTrailer(vs []tmdb.Video) string {
	best, bestScore := "", -1
	for _, v := range vs {
		if v.Site != "YouTube" {
			continue
		}
		score := 0
		switch v.Type {
		case "Trailer":
			score = 2
		case "Teaser":
			score = 1
		default:
			continue
		}
		if v.Official {
			score += 2
		}
		if score > bestScore {
			best, bestScore = v.Key, score
		}
	}
	return best
}

func toProviders(ps []tmdb.Provider) []Provider {
	out := make([]Provider, 0, len(ps))
	for _, p := range ps {
		out = append(out, Provider{Name: p.ProviderName, Logo: "https://image.tmdb.org/t/p/w92" + p.LogoPath})
	}
	return out
}
