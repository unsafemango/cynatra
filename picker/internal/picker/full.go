package picker

import (
	"context"
	"slices"
	"strconv"
	"strings"
	"sync"

	"github.com/cynatra/picker/internal/imdb"
	"github.com/cynatra/picker/internal/tmdb"
)

// FullTitle is a Title plus everything the title page shows. Saved snapshots
// (watchlist, history) keep the plain Title, so this stays out of them.
type FullTitle struct {
	*Title
	Details TitleDetails `json:"details"`
}

type TitleDetails struct {
	Tagline          string       `json:"tagline,omitempty"`
	OriginalTitle    string       `json:"originalTitle,omitempty"` // only when it differs
	Status           string       `json:"status,omitempty"`        // e.g. Released, Ended, Returning Series
	ReleaseDate      string       `json:"releaseDate,omitempty"`   // YYYY-MM-DD; first air date for series
	LastAirDate      string       `json:"lastAirDate,omitempty"`
	Certification    string       `json:"certification,omitempty"` // e.g. PG-13, TV-MA, for the region
	OriginalLanguage string       `json:"originalLanguage,omitempty"`
	Languages        []string     `json:"languages"`
	Countries        []string     `json:"countries"`
	Companies        []string     `json:"companies"`
	Networks         []Provider   `json:"networks"`
	CreatedBy        []PersonRef  `json:"createdBy"`
	Budget           int64        `json:"budget,omitempty"`  // USD
	Revenue          int64        `json:"revenue,omitempty"` // USD
	Collection       string       `json:"collection,omitempty"`
	Episodes         int          `json:"episodes,omitempty"`
	SeasonList       []Season     `json:"seasonList"`
	Cast             []CastMember `json:"cast"`
	Crew             []CrewGroup  `json:"crew"`
	Keywords         []string     `json:"keywords"`
	Homepage         string       `json:"homepage,omitempty"`
	IMDbURL          string       `json:"imdbUrl,omitempty"`
	Recommendations  []SearchHit  `json:"recommendations"`
}

type Season struct {
	Number    int    `json:"number"`
	Name      string `json:"name"`
	Episodes  int    `json:"episodes"`
	Year      int    `json:"year,omitempty"`
	PosterURL string `json:"posterUrl,omitempty"`
}

type CastMember struct {
	ID        int    `json:"id"` // TMDB person ID, for the person page
	Name      string `json:"name"`
	Character string `json:"character,omitempty"`
	Episodes  int    `json:"episodes,omitempty"` // series only
	PhotoURL  string `json:"photoUrl,omitempty"`
}

type CrewGroup struct {
	Job    string      `json:"job"`
	People []PersonRef `json:"people"`
}

// PersonRef names someone and links to their person page.
type PersonRef struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

const (
	maxCast            = 20
	maxKeywords        = 20
	maxRecommendations = 12
	maxPerJob          = 4
)

// Key crew in display order; everyone else in the credits is left out.
var crewJobs = []string{
	"Director", "Screenplay", "Writer", "Story", "Novel", "Producer", "Executive Producer",
	"Original Music Composer", "Director of Photography", "Editor",
}

// Full fetches a title with cast, crew, seasons, ratings and more.
func (p *Picker) Full(ctx context.Context, media string, id int, region string) (*FullTitle, error) {
	region = strings.ToUpper(region)
	d, err := p.tmdb.FullDetails(ctx, media, id)
	if err != nil {
		return nil, err
	}
	kind := "movie"
	if media == "tv" {
		kind = "series"
	}
	t := toTitle(attempt{kind, media}, &d.Details, region)
	markAnimation(t)
	p.addIMDb(t)
	t.Gem = IsGem(t)
	return &FullTitle{Title: t, Details: toTitleDetails(media, d, region)}, nil
}

func toTitleDetails(media string, d *tmdb.FullDetails, region string) TitleDetails {
	td := TitleDetails{
		Tagline:     d.Tagline,
		Status:      d.Status,
		ReleaseDate: d.ReleaseDate,
		Homepage:    d.Homepage,
		Budget:      d.Budget,
		Revenue:     d.Revenue,
		Languages:   []string{},
		Countries:   names(d.Countries),
		Companies:   names(d.Companies),
		Networks:    []Provider{},
		CreatedBy:   []PersonRef{},
		SeasonList:  []Season{},
		Keywords:    []string{},
	}
	original, title := d.OriginalTitle, d.Title
	credits := d.Credits
	if media == "tv" {
		original, title = d.OriginalName, d.Name
		td.ReleaseDate = d.FirstAirDate
		td.LastAirDate = d.LastAirDate
		td.Episodes = d.NumberOfEpisodes
		credits = d.AggregateCredits
	}
	for _, c := range d.CreatedBy {
		td.CreatedBy = append(td.CreatedBy, PersonRef{ID: c.ID, Name: c.Name})
	}
	if original != title {
		td.OriginalTitle = original
	}
	if d.Collection != nil {
		td.Collection = d.Collection.Name
	}
	if d.ExternalIDs.IMDbID != "" {
		td.IMDbURL = "https://www.imdb.com/title/" + d.ExternalIDs.IMDbID
	}

	td.OriginalLanguage = strings.ToUpper(d.OriginalLanguage)
	for _, l := range d.SpokenLanguages {
		name := l.EnglishName
		if name == "" {
			continue
		}
		td.Languages = append(td.Languages, name)
		if l.Code == d.OriginalLanguage {
			td.OriginalLanguage = name
		}
	}

	for _, n := range d.Networks {
		pv := Provider{Name: n.Name}
		if n.LogoPath != "" {
			pv.Logo = "https://image.tmdb.org/t/p/w154" + n.LogoPath
		}
		td.Networks = append(td.Networks, pv)
	}

	for _, s := range d.Seasons {
		if s.SeasonNumber == 0 {
			continue // specials
		}
		season := Season{Number: s.SeasonNumber, Name: s.Name, Episodes: s.EpisodeCount, Year: year(s.AirDate)}
		if s.PosterPath != "" {
			season.PosterURL = "https://image.tmdb.org/t/p/w185" + s.PosterPath
		}
		td.SeasonList = append(td.SeasonList, season)
	}

	td.Certification = certification(media, d, region)
	td.Cast = toCast(credits.Cast)
	td.Crew = toCrew(credits.Crew)

	keywords := d.Keywords.Keywords
	if media == "tv" {
		keywords = d.Keywords.Results
	}
	td.Keywords = names(keywords)
	if len(td.Keywords) > maxKeywords {
		td.Keywords = td.Keywords[:maxKeywords]
	}

	recs := d.Recommendations.Results
	for i := range recs {
		if recs[i].MediaType == "" {
			recs[i].MediaType = media
		}
	}
	td.Recommendations = searchHits(recs, maxRecommendations)
	return td
}

// certification is the age rating for the region, falling back to the US one.
func certification(media string, d *tmdb.FullDetails, region string) string {
	found := map[string]string{}
	if media == "tv" {
		for _, r := range d.ContentRatings.Results {
			if r.Rating != "" {
				found[r.Country] = r.Rating
			}
		}
	} else {
		for _, r := range d.ReleaseDates.Results {
			best := ""
			for _, rd := range r.Dates {
				if rd.Certification == "" {
					continue
				}
				// Prefer the theatrical (3) rating over premieres, digital, etc.
				if best == "" || rd.Type == 3 {
					best = rd.Certification
				}
			}
			if best != "" {
				found[r.Country] = best
			}
		}
	}
	if c, ok := found[region]; ok {
		return c
	}
	return found["US"]
}

func toCast(cast []tmdb.CastMember) []CastMember {
	out := []CastMember{}
	for _, c := range cast {
		m := CastMember{ID: c.ID, Name: c.Name, Character: c.Character, Episodes: c.TotalEpisodeCount}
		if m.Character == "" && len(c.Roles) > 0 {
			m.Character = c.Roles[0].Character
		}
		if c.ProfilePath != "" {
			m.PhotoURL = "https://image.tmdb.org/t/p/w185" + c.ProfilePath
		}
		out = append(out, m)
		if len(out) == maxCast {
			break
		}
	}
	return out
}

func toCrew(crew []tmdb.CrewMember) []CrewGroup {
	byJob := map[string][]PersonRef{}
	for _, c := range crew {
		jobs := []string{c.Job}
		for _, j := range c.Jobs {
			jobs = append(jobs, j.Job)
		}
		for _, job := range jobs {
			people := byJob[job]
			listed := slices.ContainsFunc(people, func(p PersonRef) bool { return p.ID == c.ID })
			if job != "" && slices.Contains(crewJobs, job) && !listed && len(people) < maxPerJob {
				byJob[job] = append(people, PersonRef{ID: c.ID, Name: c.Name})
			}
		}
	}
	out := []CrewGroup{}
	for _, job := range crewJobs {
		if people := byJob[job]; len(people) > 0 {
			out = append(out, CrewGroup{Job: job, People: people})
		}
	}
	return out
}

func names(ns []tmdb.Named) []string {
	out := make([]string, 0, len(ns))
	for _, n := range ns {
		if n.Name != "" {
			out = append(out, n.Name)
		}
	}
	return out
}

func year(date string) int {
	if len(date) < 4 {
		return 0
	}
	y, _ := strconv.Atoi(date[:4])
	return y
}

// IMDbRating is a title's IMDb ID and current rating, for refreshing saved titles.
type IMDbRating struct {
	IMDbID string      `json:"imdbId,omitempty"`
	IMDb   *imdb.Score `json:"imdb,omitempty"`
}

// MaxRatingsLookup caps how many titles one IMDbRatings call covers.
const MaxRatingsLookup = 50

// IMDbRatings looks up the current IMDb ratings of saved titles ("movie:603").
// Titles that can't be looked up are left out.
func (p *Picker) IMDbRatings(ctx context.Context, ids []string) map[string]IMDbRating {
	out := make(map[string]IMDbRating, len(ids))
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)
	for _, id := range ids {
		media, num, ok := strings.Cut(id, ":")
		n, err := strconv.Atoi(num)
		if !ok || (media != "movie" && media != "tv") || err != nil || n <= 0 {
			continue
		}
		wg.Go(func() {
			sem <- struct{}{}
			defer func() { <-sem }()
			kind := "movie"
			if media == "tv" {
				kind = "series"
			}
			t, err := p.details(ctx, attempt{kind, media}, n, "US")
			if err != nil {
				return
			}
			mu.Lock()
			out[id] = IMDbRating{IMDbID: t.IMDbID, IMDb: t.IMDb}
			mu.Unlock()
		})
	}
	wg.Wait()
	return out
}
