package picker

import "time"

// Hidden gems: titles people rate highly but relatively few have watched.
// Well known enough to trust the rating (a vote floor), not so well known that
// everyone's seen them (a cap). IMDb's numbers decide; TMDB's (much smaller,
// roughly 1/30 of IMDb's) pre-filter discover and stand in when IMDb has none.
// New releases don't count: they have few ratings only because they're new.

const gemMinRating = 7.3

type voteBand struct{ min, max int }

var (
	imdbGemVotes = map[string]voteBand{"movie": {2000, 40000}, "tv": {1000, 25000}}
	tmdbGemVotes = map[string]voteBand{"movie": {150, 1500}, "tv": {60, 1000}}
)

func (b voteBand) contains(n int) bool { return n >= b.min && n <= b.max }

// gemMinAge: how long a title must have been out (its ratings have settled).
const gemMinAge = 365 * 24 * time.Hour

// gemReleasedBefore is the latest release date a hidden gem can have.
func gemReleasedBefore(now time.Time) time.Time { return now.Add(-gemMinAge) }

// IsGem reports whether a title is a hidden gem (cards show a badge for it).
func IsGem(t *Title) bool { return isGemAt(t, time.Now()) }

func isGemAt(t *Title, now time.Time) bool {
	// Out for at least a year (by year: it's what titles carry).
	if t.Year == 0 || t.Year > gemReleasedBefore(now).Year() {
		return false
	}
	media := t.MediaType
	if media != "tv" {
		media = "movie"
	}
	if t.IMDb != nil {
		return t.IMDb.Rating >= gemMinRating && imdbGemVotes[media].contains(t.IMDb.Votes)
	}
	return t.Rating >= gemMinRating && tmdbGemVotes[media].contains(t.VoteCount)
}
