package picker

import (
	"cmp"
	"context"
	"fmt"
	"maps"
	"math"
	"math/rand/v2"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/cynatra/picker/internal/tmdb"
)

// Taste is what a user's likes and dislikes say about them, as the gateway
// builds it: a signed weight per genre, decade and person. Positive means they
// lean toward it, negative away.
type Taste struct {
	Genres  []Weighted[string] `json:"genres"`  // TMDB genre names, as on Title.Genres
	Decades []Weighted[int]    `json:"decades"` // 1990, 2000, ...
	People  []Weighted[int]    `json:"people"`  // TMDB person IDs
}

type Weighted[K comparable] struct {
	Key    K       `json:"key"`
	Weight float64 `json:"weight"`
}

// maxTraits caps each list in a taste.
const maxTraits = 20

// normalizeTaste checks a request's taste and drops one with nothing in it.
func normalizeTaste(r *Request) error {
	t := r.Taste
	if t == nil {
		return nil
	}
	if len(t.Genres) > maxTraits || len(t.Decades) > maxTraits || len(t.People) > maxTraits {
		return fmt.Errorf("too many taste traits")
	}
	t.Genres = weighted(t.Genres)
	t.Decades = weighted(t.Decades)
	t.People = weighted(t.People)
	if len(t.Genres)+len(t.Decades)+len(t.People) == 0 {
		r.Taste = nil
	}
	return nil
}

// weighted leaves out traits the user is neutral about.
func weighted[K comparable](ws []Weighted[K]) []Weighted[K] {
	return slices.DeleteFunc(ws, func(w Weighted[K]) bool { return w.Weight == 0 })
}

// TMDB's genre names, as the profile has them (they come from title details).
var tmdbGenreIDs = map[string]int{
	"Action": 28, "Adventure": 12, "Animation": animationGenreID, "Comedy": 35, "Crime": 80,
	"Documentary": 99, "Drama": 18, "Family": 10751, "Fantasy": 14, "History": 36, "Horror": 27,
	"Music": 10402, "Mystery": 9648, "Romance": 10749, "Science Fiction": 878, "TV Movie": 10770,
	"Thriller": 53, "War": 10752, "Western": 37,
	// Series only.
	"Action & Adventure": 10759, "Kids": 10762, "News": 10763, "Reality": 10764,
	"Sci-Fi & Fantasy": 10765, "Soap": 10766, "Talk": 10767, "War & Politics": 10768,
}

// genreTraits names what a TMDB genre ID stands for. Movies and series split
// genres differently, so IDs become Cynatra's slugs: liking science fiction
// movies counts toward "Sci-Fi & Fantasy" series too.
func genreTraits(id int) []string {
	var traits []string
	for _, g := range Genres {
		if g.Movie == id || g.TV == id {
			traits = append(traits, g.Slug)
		}
	}
	if len(traits) == 0 {
		return []string{strconv.Itoa(id)} // a genre Cynatra has no filter for
	}
	return traits
}

// scorer is a Taste ready to rate titles with.
type scorer struct {
	genres   map[string]float64 // by trait, -1 to 1
	decades  map[int]float64    // -1 to 1
	liked    []int              // people, strongest first
	disliked map[int]bool
}

// Weights grow with the number of ratings, so each kind is scaled by its
// strongest. The floor keeps one stray rating from counting as a firm opinion.
const minScale = 2.0

// A matching decade says less about a title than its genres do.
const decadeShare = 0.5

func newScorer(t *Taste) *scorer {
	if t == nil {
		return nil
	}
	genres := map[string]float64{}
	for _, w := range t.Genres {
		id, ok := tmdbGenreIDs[w.Key]
		if !ok {
			continue
		}
		traits := genreTraits(id)
		for _, trait := range traits {
			genres[trait] += w.Weight / float64(len(traits))
		}
	}
	decades := map[int]float64{}
	for _, w := range t.Decades {
		decades[w.Key] += w.Weight
	}
	people := slices.Clone(t.People)
	slices.SortStableFunc(people, func(a, b Weighted[int]) int { return cmp.Compare(b.Weight, a.Weight) })
	var liked []int
	disliked := map[int]bool{}
	for _, w := range people {
		switch {
		case w.Weight < 0:
			disliked[w.Key] = true
		case w.Key > 0 && len(liked) < maxLikedPeople:
			liked = append(liked, w.Key)
		}
	}
	return &scorer{genres: scaled(genres), decades: scaled(decades), liked: liked, disliked: disliked}
}

const (
	// How often a spin looks for liked people first. Kept low: their movies are
	// a small pool that would soon repeat.
	likedPeopleShare = 0.25
	maxLikedPeople   = 8
)

// peopleQuery narrows a discover query to movies with any of the liked people.
// TMDB can't filter series by who's in them.
func (s *scorer) peopleQuery(a attempt, q url.Values) (url.Values, bool) {
	if s == nil || len(s.liked) == 0 || a.media != "movie" {
		return nil, false
	}
	ids := make([]string, len(s.liked))
	for i, id := range s.liked {
		ids[i] = strconv.Itoa(id)
	}
	focused := maps.Clone(q)
	focused.Set("with_people", strings.Join(ids, "|")) // | = OR
	return focused, true
}

func scaled[K comparable](m map[K]float64) map[K]float64 {
	top := minScale
	for _, w := range m {
		top = max(top, math.Abs(w))
	}
	for k, w := range m {
		m[k] = w / top
	}
	return m
}

// score says how well a title fits: positive for traits the user liked,
// negative for ones they disliked, 0 when there's nothing to go on.
func (s *scorer) score(genreIDs []int, year int) float64 {
	var sum float64
	n := 0
	for _, id := range genreIDs {
		for _, trait := range genreTraits(id) {
			sum += s.genres[trait]
			n++
		}
	}
	var total float64
	if n > 0 {
		total = sum / float64(n)
	}
	if year > 0 {
		total += decadeShare * s.decades[year/10*10]
	}
	return total
}

// How hard a taste leans on the draw: a title scoring 1 is e² (about seven)
// times as likely to come first as a neutral one, which is that much likelier
// than one scoring -1. Nothing is ruled out.
const tasteStrength = 2.0

// shuffle puts candidates in random order. Without a taste every order is as
// likely; with one, each next title is drawn in proportion to its odds.
func (s *scorer) shuffle(candidates []tmdb.DiscoverResult) {
	if s == nil {
		rand.Shuffle(len(candidates), func(i, j int) { candidates[i], candidates[j] = candidates[j], candidates[i] })
		return
	}
	// Weighted sampling without replacement: sort by an exponential draw
	// divided by the title's odds.
	type drawn struct {
		res tmdb.DiscoverResult
		at  float64
	}
	order := make([]drawn, len(candidates))
	for i, c := range candidates {
		date := c.ReleaseDate
		if date == "" {
			date = c.FirstAirDate
		}
		odds := math.Exp(tasteStrength * s.score(c.GenreIDs, year(date)))
		order[i] = drawn{c, rand.ExpFloat64() / odds}
	}
	slices.SortFunc(order, func(a, b drawn) int { return cmp.Compare(a.at, b.at) })
	for i, d := range order {
		candidates[i] = d.res
	}
}

const (
	// Titles passed over per spin for who's in them; after that the draw stands.
	maxAvoided = 3
	// How far down the cast a disliked person counts, as in the gateway's profile.
	leadCast = 5
)

// avoided counts the titles a spin passed over, keeping the first in case
// nothing else turns up.
type avoided struct {
	n     int
	title *Title
}

// holdBack reports whether to pass over a title because someone the user
// disliked made it or leads its cast.
func (p *Picker) holdBack(ctx context.Context, a attempt, r Request, t *Title, avoid *avoided) bool {
	if r.scorer == nil || len(r.scorer.disliked) == 0 || avoid.n >= maxAvoided {
		return false
	}
	d, err := p.tmdb.FullDetails(ctx, a.media, t.TMDBID)
	if err != nil {
		return false // the pick matters more than the taste
	}
	if !slices.ContainsFunc(leadPeople(a.media, d), func(id int) bool { return r.scorer.disliked[id] }) {
		return false
	}
	avoid.n++
	if avoid.title == nil {
		avoid.title = t
	}
	return true
}

// leadPeople is a title's creators, directors and top-billed cast.
func leadPeople(media string, d *tmdb.FullDetails) []int {
	credits := d.Credits
	if media == "tv" {
		credits = d.AggregateCredits
	}
	var ids []int
	for _, c := range d.CreatedBy {
		ids = append(ids, c.ID)
	}
	for _, g := range toCrew(credits.Crew) {
		if g.Job == "Director" {
			for _, person := range g.People {
				ids = append(ids, person.ID)
			}
		}
	}
	for _, c := range credits.Cast[:min(leadCast, len(credits.Cast))] {
		ids = append(ids, c.ID)
	}
	return ids
}
