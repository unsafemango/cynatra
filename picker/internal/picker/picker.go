// Package picker turns a set of filters into one random TMDB title.
package picker

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/cynatra/picker/internal/imdb"
	"github.com/cynatra/picker/internal/look"
	"github.com/cynatra/picker/internal/tmdb"
)

// TMDB only serves the first 500 pages of discover; we stay well under that
// so picks lean toward titles people have actually heard of.
const maxPages = 100

var ErrNoMatch = errors.New("no titles match these filters")

// DefaultRegion is the country for streaming availability when none is given:
// Canada, where Cynatra is made.
const DefaultRegion = "CA"

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
	Look       string   `json:"look"`       // "any" | "colorful" (bright & colourful)
	Format     string   `json:"format"`     // "" | "miniseries" (limited series only)
	// Only titles streaming on these services in Region (keys like "netflix").
	Services []string `json:"services"`

	providerIDs []int // Services as TMDB provider IDs, filled in by Pick
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
	Rating       float64       `json:"rating"`    // TMDB user score, 0–10
	VoteCount    int           `json:"voteCount"` // TMDB votes
	IMDbID       string        `json:"imdbId,omitempty"`
	IMDb         *imdb.Score   `json:"imdb,omitempty"` // missing when IMDb has no rating for it
	Year         int           `json:"year,omitempty"`
	Runtime      int           `json:"runtime,omitempty"` // minutes (per episode for series)
	Seasons      int           `json:"seasons,omitempty"`
	Genres       []string      `json:"genres"`
	TrailerKey   string        `json:"trailerKey,omitempty"` // YouTube video ID
	TMDBURL      string        `json:"tmdbUrl"`
	WhereToWatch *WhereToWatch `json:"whereToWatch,omitempty"`
	// Colorful is set when the title was picked by the bright & colourful look filter.
	Colorful bool `json:"colorful,omitempty"`
}

type Picker struct {
	tmdb    *tmdb.Client
	looks   *look.Scorer
	ratings *imdb.Ratings
}

func New(c *tmdb.Client, looks *look.Scorer, ratings *imdb.Ratings) *Picker {
	return &Picker{tmdb: c, looks: looks, ratings: ratings}
}

// The minimum rating is an IMDb rating. TMDB's discover can only filter by its
// own score, so it's asked for titles up to this much below the minimum, and
// each pick is then checked against IMDb.
const imdbSlack = 1.0

// Titles checked against the IMDb minimum: at most this many per page, and in
// total per kind of title, so a very high minimum can't make a spin crawl.
const (
	maxChecksPerPage = 6
	maxChecks        = 30
)

// imdbMinimum reports whether the minimum rating is checked against IMDb.
func (p *Picker) imdbMinimum(r Request) bool {
	return r.MinRating > 0 && p.ratings != nil && p.ratings.Loaded()
}

// meetsMinimum checks a title's IMDb rating, or TMDB's when IMDb has none.
func meetsMinimum(t *Title, min float64) bool {
	if t.IMDb != nil {
		return t.IMDb.Rating >= min
	}
	return t.Rating >= min
}

// addIMDb fills in the IMDb rating, when the dataset has one for the title.
func (p *Picker) addIMDb(t *Title) {
	if p.ratings == nil || t.IMDbID == "" {
		return
	}
	if s, ok := p.ratings.Lookup(t.IMDbID); ok {
		t.IMDb = &s
	}
}

// With the look filter on, each page costs image downloads (cached afterwards),
// so only this many pages are searched before giving up.
const maxLookPages = 8

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
	switch r.Look {
	case "", "any":
		r.Look = "any"
	case "colorful", "colourful":
		r.Look = "colorful"
	default:
		return fmt.Errorf("unknown look %q", r.Look)
	}
	switch r.Format {
	case "", "miniseries":
	default:
		return fmt.Errorf("unknown format %q", r.Format)
	}
	if r.Region == "" {
		r.Region = DefaultRegion
	}
	r.Region = strings.ToUpper(r.Region)
	if len(r.Services) > 30 {
		return fmt.Errorf("too many services")
	}
	for _, k := range r.Services {
		if !serviceKeyPattern.MatchString(k) {
			return fmt.Errorf("unknown service %q", k)
		}
	}
	return nil
}

// Pick returns one random title. For "any" and "animation", it tries each
// eligible kind/media combination in random order until one has results.
func (p *Picker) Pick(ctx context.Context, r Request) (*Title, error) {
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
	discover := r
	if p.imdbMinimum(r) {
		discover.MinRating = max(0, r.MinRating-imdbSlack)
	}
	q, ok := buildQuery(a, discover)
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
	budget := pages
	if r.Look == "colorful" {
		budget = min(pages, maxLookPages)
	}

	// Sample a few random pages; fall back to scanning in order if the user
	// has excluded most of a small result set.
	checks := 0
	tried := map[int]bool{}
	for i := 0; i < 5 && len(tried) < budget; i++ {
		n := rand.IntN(pages) + 1
		if tried[n] {
			continue
		}
		tried[n] = true
		if t, ok, err := p.tryPage(ctx, a, r, q, n, first, excluded, &checks); err != nil || ok {
			return t, err
		}
	}
	for n := 1; n <= pages && len(tried) < budget; n++ {
		if tried[n] {
			continue
		}
		tried[n] = true
		if t, ok, err := p.tryPage(ctx, a, r, q, n, first, excluded, &checks); err != nil || ok {
			return t, err
		}
	}
	return nil, ErrNoMatch
}

func (p *Picker) tryPage(ctx context.Context, a attempt, r Request, q url.Values, n int, first *tmdb.DiscoverPage, excluded map[string]bool, checks *int) (*Title, bool, error) {
	candidates, err := p.candidatesFromPage(ctx, a.media, q, n, first, excluded, r.Look == "colorful")
	if err != nil {
		return nil, false, err
	}
	checkIMDb := p.imdbMinimum(r)
	for i, res := range candidates {
		if i == maxChecksPerPage {
			break
		}
		t, err := p.details(ctx, a, res.ID, r.Region)
		if err != nil {
			return nil, false, err
		}
		if checkIMDb && !meetsMinimum(t, r.MinRating) {
			if *checks++; *checks >= maxChecks {
				return nil, false, ErrNoMatch
			}
			continue
		}
		if r.Look == "colorful" {
			t.Colorful = true
		}
		return t, true, nil
	}
	return nil, false, nil
}

// candidatesFromPage returns the page's titles that aren't excluded, shuffled.
func (p *Picker) candidatesFromPage(ctx context.Context, media string, q url.Values, n int, first *tmdb.DiscoverPage, excluded map[string]bool, colorful bool) ([]tmdb.DiscoverResult, error) {
	page := first
	if n != 1 {
		var err error
		if page, err = p.tmdb.Discover(ctx, media, withPage(q, n)); err != nil {
			return nil, err
		}
	}
	var candidates []tmdb.DiscoverResult
	for _, res := range page.Results {
		if !excluded[fmt.Sprintf("%s:%d", media, res.ID)] {
			candidates = append(candidates, res)
		}
	}
	if colorful {
		candidates = p.brightAndColorful(ctx, candidates)
	}
	rand.Shuffle(len(candidates), func(i, j int) { candidates[i], candidates[j] = candidates[j], candidates[i] })
	return candidates, nil
}

// brightAndColorful keeps the candidates whose backdrop and poster look vivid.
// Images are scored in parallel; one that can't be fetched just doesn't count.
func (p *Picker) brightAndColorful(ctx context.Context, candidates []tmdb.DiscoverResult) []tmdb.DiscoverResult {
	keep := make([]bool, len(candidates))
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup
	for i, c := range candidates {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			var scores []look.Score
			for _, path := range []string{c.BackdropPath, c.PosterPath} {
				if path == "" {
					continue
				}
				if s, err := p.looks.ScorePath(ctx, path); err == nil {
					scores = append(scores, s)
				}
			}
			keep[i] = look.BrightAndColorful(scores...)
		}()
	}
	wg.Wait()
	var out []tmdb.DiscoverResult
	for i, c := range candidates {
		if keep[i] {
			out = append(out, c)
		}
	}
	return out
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
	if r.Format == "miniseries" {
		if a.media != "tv" {
			return nil, false // only series can be limited series
		}
		q.Set("with_type", "2") // TMDB's TV type 2: Miniseries
	}
	if a.kind == "animation" {
		g := strconv.Itoa(animationGenreID)
		if len(ids) > 0 {
			// TMDB can't express "animation AND (x OR y)", so pick one of x/y.
			g += "," + strconv.Itoa(ids[rand.IntN(len(ids))])
		}
		q.Set("with_genres", g)
	} else if len(ids) > 0 {
		parts := make([]string, len(ids))
		for i, id := range ids {
			parts[i] = strconv.Itoa(id)
		}
		q.Set("with_genres", strings.Join(parts, "|")) // | = OR
	}

	var without []string
	if a.kind != "animation" {
		without = append(without, strconv.Itoa(animationGenreID))
	}
	if r.Look == "colorful" {
		// A vivid poster doesn't make a crime thriller light-hearted, so the
		// bright & colourful look leaves out dark genres the user didn't ask for.
		for _, id := range darkGenreIDs(a.media) {
			if !slices.Contains(ids, id) {
				without = append(without, strconv.Itoa(id))
			}
		}
	}
	if len(without) > 0 {
		q.Set("without_genres", strings.Join(without, ",")) // excludes titles with any of them
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
	if len(r.providerIDs) > 0 {
		// Streaming (not rent/buy) on any of the chosen services, in the user's country.
		parts := make([]string, len(r.providerIDs))
		for i, id := range r.providerIDs {
			parts[i] = strconv.Itoa(id)
		}
		q.Set("watch_region", r.Region)
		q.Set("with_watch_providers", strings.Join(parts, "|"))
		q.Set("with_watch_monetization_types", "flatrate")
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
	markAnimation(t)
	return t, nil
}

// markAnimation sets the kind of a title looked up by ID, which may be animated.
func markAnimation(t *Title) {
	if slices.Contains(t.Genres, "Animation") {
		t.Kind = "animation"
	}
}

func (p *Picker) details(ctx context.Context, a attempt, id int, region string) (*Title, error) {
	d, err := p.tmdb.Details(ctx, a.media, id)
	if err != nil {
		return nil, err
	}
	t := toTitle(a, d, region)
	p.addIMDb(t)
	return t, nil
}

func toTitle(a attempt, d *tmdb.Details, region string) *Title {
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
		IMDbID:    d.ExternalIDs.IMDbID,
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
	return t
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
