package picker

// Genre is a Cynatra genre slug and how it maps onto TMDB's (different)
// movie and TV genre lists. A zero ID means TMDB has no equivalent.
type Genre struct {
	Slug  string `json:"slug"`
	Label string `json:"label"`
	Movie int    `json:"-"`
	TV    int    `json:"-"`
}

// TMDB genre IDs: https://developer.themoviedb.org/reference/genre-movie-list
var Genres = []Genre{
	{"action", "Action", 28, 10759},
	{"adventure", "Adventure", 12, 10759},
	{"comedy", "Comedy", 35, 35},
	{"crime", "Crime", 80, 80},
	{"documentary", "Documentary", 99, 99},
	{"drama", "Drama", 18, 18},
	{"family", "Family", 10751, 10751},
	{"fantasy", "Fantasy", 14, 10765},
	{"history", "History", 36, 0},
	{"horror", "Horror", 27, 0},
	{"music", "Music", 10402, 0},
	{"mystery", "Mystery", 9648, 9648},
	{"romance", "Romance", 10749, 0},
	{"scifi", "Sci-Fi", 878, 10765},
	{"thriller", "Thriller", 53, 0},
	{"war", "War", 10752, 10768},
	{"western", "Western", 37, 37},
}

const animationGenreID = 16

var genreBySlug = func() map[string]Genre {
	m := make(map[string]Genre, len(Genres))
	for _, g := range Genres {
		m[g.Slug] = g
	}
	return m
}()

// genreIDs maps slugs to unique TMDB IDs for the given media type,
// silently dropping slugs that TMDB doesn't support for it.
func genreIDs(slugs []string, media string) []int {
	seen := map[int]bool{}
	var ids []int
	for _, s := range slugs {
		g, ok := genreBySlug[s]
		if !ok {
			continue
		}
		id := g.Movie
		if media == "tv" {
			id = g.TV
		}
		if id != 0 && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return ids
}

// darkGenreIDs are left out by the bright & colourful look unless asked for:
// crime, thriller, horror and war (TV has no thriller or horror genre).
func darkGenreIDs(media string) []int {
	if media == "tv" {
		return []int{80, 10768}
	}
	return []int{80, 53, 27, 10752}
}
