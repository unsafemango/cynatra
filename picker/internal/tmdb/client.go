// Package tmdb is a minimal client for the parts of the TMDB v3 API Cynatra uses.
package tmdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/cynatra/picker/internal/cache"
)

const baseURL = "https://api.themoviedb.org/3"

var ErrNotFound = errors.New("tmdb: not found")

const (
	discoverTTL = 6 * time.Hour
	detailsTTL  = 24 * time.Hour
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
	ID int `json:"id"`
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
}

// Discover calls /discover/{movie|tv}. Results are cached by query.
func (c *Client) Discover(ctx context.Context, media string, q url.Values) (*DiscoverPage, error) {
	var page DiscoverPage
	if err := c.get(ctx, "/discover/"+media, q, discoverTTL, &page); err != nil {
		return nil, err
	}
	return &page, nil
}

// Details fetches a title with videos and watch providers appended.
func (c *Client) Details(ctx context.Context, media string, id int) (*Details, error) {
	q := url.Values{"append_to_response": {"videos,watch/providers"}}
	var d Details
	if err := c.get(ctx, fmt.Sprintf("/%s/%d", media, id), q, detailsTTL, &d); err != nil {
		return nil, err
	}
	return &d, nil
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
