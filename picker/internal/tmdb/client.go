// Package tmdb is a minimal client for the parts of the TMDB v3 API Cynatra uses.
package tmdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/cynatra/picker/internal/cache"
)

const baseURL = "https://api.themoviedb.org/3"

var ErrNotFound = errors.New("tmdb: not found")

const (
	discoverTTL = 6 * time.Hour
	detailsTTL  = 24 * time.Hour
	searchTTL   = 1 * time.Hour
)

type Client struct {
	key   string
	http  *http.Client
	cache cache.Cache
}

// NewClient accepts either a v3 API key or a v4 read access token (JWT).
func NewClient(key string, c cache.Cache) *Client {
	return &Client{key: key, http: &http.Client{Timeout: 10 * time.Second}, cache: c}
}

type DiscoverResult struct {
	ID           int    `json:"id"`
	PosterPath   string `json:"poster_path"`
	BackdropPath string `json:"backdrop_path"`
	// Enough to list a result without fetching its details (browse lists).
	Title        string `json:"title"` // movies
	Name         string `json:"name"`  // series
	ReleaseDate  string `json:"release_date"`
	FirstAirDate string `json:"first_air_date"`
	GenreIDs     []int  `json:"genre_ids"`
	VoteCount    int    `json:"vote_count"`
}

type DiscoverPage struct {
	Page         int              `json:"page"`
	TotalPages   int              `json:"total_pages"`
	TotalResults int              `json:"total_results"`
	Results      []DiscoverResult `json:"results"`
}

type Genre struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Video struct {
	Key      string `json:"key"`
	Site     string `json:"site"`
	Type     string `json:"type"`
	Official bool   `json:"official"`
}

type Provider struct {
	ProviderName string `json:"provider_name"`
	LogoPath     string `json:"logo_path"`
}

type RegionProviders struct {
	Link     string     `json:"link"`
	Flatrate []Provider `json:"flatrate"`
	Rent     []Provider `json:"rent"`
	Buy      []Provider `json:"buy"`
}

// Details covers both /movie/{id} and /tv/{id}; unused fields stay zero.
type Details struct {
	ID              int     `json:"id"`
	Title           string  `json:"title"`
	Name            string  `json:"name"`
	Overview        string  `json:"overview"`
	PosterPath      string  `json:"poster_path"`
	BackdropPath    string  `json:"backdrop_path"`
	VoteAverage     float64 `json:"vote_average"`
	VoteCount       int     `json:"vote_count"`
	ReleaseDate     string  `json:"release_date"`
	FirstAirDate    string  `json:"first_air_date"`
	Runtime         int     `json:"runtime"`
	EpisodeRunTime  []int   `json:"episode_run_time"`
	NumberOfSeasons int     `json:"number_of_seasons"`
	Genres          []Genre `json:"genres"`
	Videos          struct {
		Results []Video `json:"results"`
	} `json:"videos"`
	WatchProviders struct {
		Results map[string]RegionProviders `json:"results"`
	} `json:"watch/providers"`
	ExternalIDs struct {
		IMDbID string `json:"imdb_id"` // e.g. tt0133093, for the IMDb rating
	} `json:"external_ids"`
}

type Named struct {
	Name string `json:"name"`
}

type Network struct {
	Name     string `json:"name"`
	LogoPath string `json:"logo_path"`
}

type Language struct {
	Code        string `json:"iso_639_1"`
	EnglishName string `json:"english_name"`
}

type Season struct {
	SeasonNumber int    `json:"season_number"`
	Name         string `json:"name"`
	EpisodeCount int    `json:"episode_count"`
	AirDate      string `json:"air_date"`
	PosterPath   string `json:"poster_path"`
}

// CastMember covers /credits (Character) and TV /aggregate_credits (Roles).
type CastMember struct {
	ID                int    `json:"id"`
	Name              string `json:"name"`
	ProfilePath       string `json:"profile_path"`
	Character         string `json:"character"`
	TotalEpisodeCount int    `json:"total_episode_count"`
	Roles             []struct {
		Character string `json:"character"`
	} `json:"roles"`
}

// CrewMember covers /credits (Job) and TV /aggregate_credits (Jobs).
type CrewMember struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Job  string `json:"job"`
	Jobs []struct {
		Job string `json:"job"`
	} `json:"jobs"`
}

type Credits struct {
	Cast []CastMember `json:"cast"`
	Crew []CrewMember `json:"crew"`
}

// FullDetails is a title with everything the title page shows. Movies and
// series name some parts differently; the unused ones stay zero.
type FullDetails struct {
	Details
	Tagline          string     `json:"tagline"`
	Status           string     `json:"status"`
	Homepage         string     `json:"homepage"`
	OriginalTitle    string     `json:"original_title"`
	OriginalName     string     `json:"original_name"`
	OriginalLanguage string     `json:"original_language"`
	SpokenLanguages  []Language `json:"spoken_languages"`
	Countries        []Named    `json:"production_countries"`
	Companies        []Named    `json:"production_companies"`
	Budget           int64      `json:"budget"`
	Revenue          int64      `json:"revenue"`
	Collection       *Named     `json:"belongs_to_collection"`
	// Series only.
	LastAirDate      string    `json:"last_air_date"`
	NumberOfEpisodes int       `json:"number_of_episodes"`
	Networks         []Network `json:"networks"`
	CreatedBy        []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"created_by"`
	Seasons []Season `json:"seasons"`

	Credits          Credits `json:"credits"`           // movies
	AggregateCredits Credits `json:"aggregate_credits"` // series: every season
	ReleaseDates     struct {
		Results []struct {
			Country string `json:"iso_3166_1"`
			Dates   []struct {
				Certification string `json:"certification"`
				Type          int    `json:"type"`
			} `json:"release_dates"`
		} `json:"results"`
	} `json:"release_dates"` // movies
	ContentRatings struct {
		Results []struct {
			Country string `json:"iso_3166_1"`
			Rating  string `json:"rating"`
		} `json:"results"`
	} `json:"content_ratings"` // series
	Keywords struct {
		Keywords []Named `json:"keywords"` // movies
		Results  []Named `json:"results"`  // series
	} `json:"keywords"`
	Recommendations struct {
		Results []SearchResult `json:"results"`
	} `json:"recommendations"`
}

// PersonCredit is one movie or series in a person's combined credits.
type PersonCredit struct {
	SearchResult
	Character    string `json:"character"`     // cast
	Job          string `json:"job"`           // crew
	EpisodeCount int    `json:"episode_count"` // series
	CreditID     string `json:"credit_id"`
}

// Credit is one credit with the episodes or seasons it covers (series only):
// guest roles list their episodes, regular roles their seasons.
type Credit struct {
	Media struct {
		Episodes []struct {
			SeasonNumber  int    `json:"season_number"`
			EpisodeNumber int    `json:"episode_number"`
			Name          string `json:"name"`
			AirDate       string `json:"air_date"`
		} `json:"episodes"`
		Seasons []struct {
			SeasonNumber int `json:"season_number"`
		} `json:"seasons"`
	} `json:"media"`
}

type Person struct {
	ID                 int      `json:"id"`
	Name               string   `json:"name"`
	Biography          string   `json:"biography"`
	Birthday           string   `json:"birthday"`
	Deathday           string   `json:"deathday"`
	PlaceOfBirth       string   `json:"place_of_birth"`
	KnownForDepartment string   `json:"known_for_department"`
	AlsoKnownAs        []string `json:"also_known_as"`
	ProfilePath        string   `json:"profile_path"`
	Homepage           string   `json:"homepage"`
	CombinedCredits    struct {
		Cast []PersonCredit `json:"cast"`
		Crew []PersonCredit `json:"crew"`
	} `json:"combined_credits"`
	ExternalIDs struct {
		IMDbID      string `json:"imdb_id"`
		InstagramID string `json:"instagram_id"`
	} `json:"external_ids"`
}

// WatchProvider is a streaming service TMDB knows in a region.
type WatchProvider struct {
	ProviderID        int            `json:"provider_id"`
	ProviderName      string         `json:"provider_name"`
	LogoPath          string         `json:"logo_path"`
	DisplayPriority   int            `json:"display_priority"`
	DisplayPriorities map[string]int `json:"display_priorities"` // per region; lower is more prominent
}

// WatchProviders lists the streaming services for movies or series in a region.
func (c *Client) WatchProviders(ctx context.Context, media, region string) ([]WatchProvider, error) {
	var out struct {
		Results []WatchProvider `json:"results"`
	}
	q := url.Values{"watch_region": {region}}
	if err := c.get(ctx, "/watch/providers/"+media, q, detailsTTL, &out); err != nil {
		return nil, err
	}
	return out.Results, nil
}

// Discover calls /discover/{movie|tv}. Results are cached by query.
func (c *Client) Discover(ctx context.Context, media string, q url.Values) (*DiscoverPage, error) {
	var page DiscoverPage
	if err := c.get(ctx, "/discover/"+media, q, discoverTTL, &page); err != nil {
		return nil, err
	}
	return &page, nil
}

// SearchResult is one hit from /search/multi (movies, series and people mixed).
type SearchResult struct {
	ID           int     `json:"id"`
	MediaType    string  `json:"media_type"` // movie | tv | person
	Title        string  `json:"title"`
	Name         string  `json:"name"`
	ReleaseDate  string  `json:"release_date"`
	FirstAirDate string  `json:"first_air_date"`
	PosterPath   string  `json:"poster_path"`
	GenreIDs     []int   `json:"genre_ids"`
	VoteCount    int     `json:"vote_count"`
	Popularity   float64 `json:"popularity"`
}

// SearchMulti searches movies and series by name.
func (c *Client) SearchMulti(ctx context.Context, query string) ([]SearchResult, error) {
	var page struct {
		Results []SearchResult `json:"results"`
	}
	q := url.Values{"query": {query}, "include_adult": {"false"}, "page": {"1"}}
	if err := c.get(ctx, "/search/multi", q, searchTTL, &page); err != nil {
		return nil, err
	}
	return page.Results, nil
}

// Details fetches a title with videos, watch providers and external IDs appended.
func (c *Client) Details(ctx context.Context, media string, id int) (*Details, error) {
	q := url.Values{"append_to_response": {"videos,watch/providers,external_ids"}}
	var d Details
	if err := c.get(ctx, fmt.Sprintf("/%s/%d", media, id), q, detailsTTL, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

// FullDetails fetches a title with credits, ratings, keywords,
// recommendations and external IDs too, in one request.
func (c *Client) FullDetails(ctx context.Context, media string, id int) (*FullDetails, error) {
	extra := "credits,release_dates"
	if media == "tv" {
		extra = "aggregate_credits,content_ratings"
	}
	q := url.Values{"append_to_response": {"videos,watch/providers,keywords,recommendations,external_ids," + extra}}
	var d FullDetails
	if err := c.get(ctx, fmt.Sprintf("/%s/%d", media, id), q, detailsTTL, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

// Person fetches an actor or crew member with every credit, in one request.
func (c *Client) Person(ctx context.Context, id int) (*Person, error) {
	q := url.Values{"append_to_response": {"combined_credits,external_ids"}}
	var p Person
	if err := c.get(ctx, fmt.Sprintf("/person/%d", id), q, detailsTTL, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

// PopularPerson is one entry from /person/popular.
type PopularPerson struct {
	ID          int    `json:"id"`
	ProfilePath string `json:"profile_path"`
	Adult       bool   `json:"adult"`
}

// PeoplePage is a page of /person/popular.
type PeoplePage struct {
	Page       int             `json:"page"`
	TotalPages int             `json:"total_pages"`
	Results    []PopularPerson `json:"results"`
}

// PopularPeople lists the people TMDB users look at most (one page of 20).
func (c *Client) PopularPeople(ctx context.Context, page int) (*PeoplePage, error) {
	var out PeoplePage
	q := url.Values{"page": {strconv.Itoa(page)}}
	if err := c.get(ctx, "/person/popular", q, discoverTTL, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Credit fetches a single credit by its ID (from a person's credits).
func (c *Client) Credit(ctx context.Context, id string) (*Credit, error) {
	var cr Credit
	if err := c.get(ctx, "/credit/"+url.PathEscape(id), url.Values{}, detailsTTL, &cr); err != nil {
		return nil, err
	}
	return &cr, nil
}

func (c *Client) get(ctx context.Context, path string, q url.Values, ttl time.Duration, out any) error {
	cacheKey := "tmdb:" + path + "?" + q.Encode()
	if b, ok := c.cache.Get(ctx, cacheKey); ok {
		return json.Unmarshal(b, out)
	}

	reqQ := url.Values{}
	for k, v := range q {
		reqQ[k] = v
	}
	isBearer := strings.HasPrefix(c.key, "eyJ")
	if !isBearer {
		reqQ.Set("api_key", c.key)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+path+"?"+reqQ.Encode(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if isBearer {
		req.Header.Set("Authorization", "Bearer "+c.key)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("tmdb request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("tmdb %s: status %d", path, resp.StatusCode)
	}

	var raw json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return fmt.Errorf("tmdb decode: %w", err)
	}
	c.cache.Set(ctx, cacheKey, raw, ttl)
	return json.Unmarshal(raw, out)
}
