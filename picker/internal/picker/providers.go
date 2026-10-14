package picker

import (
	"cmp"
	"context"
	"errors"
	"regexp"
	"slices"

	"github.com/cynatra/picker/internal/tmdb"
)

// StreamingOption is a streaming service someone can filter spins by, in a
// region. Ad tiers and channels are merged in, as in the Services report.
type StreamingOption struct {
	Key  string `json:"key"`
	Name string `json:"name"`
	Logo string `json:"logo,omitempty"`
	// TMDB provider IDs behind it (e.g. Netflix and Netflix Standard with Ads).
	providerIDs []int
	priority    int
}

// ErrNoServices means none of the requested services exist in the region.
var ErrNoServices = errors.New("none of those streaming services are available in this country")

var serviceKeyPattern = regexp.MustCompile(`^[a-z0-9-]{1,60}$`)

// Rent/buy stores aren't subscriptions, so "streaming on" them never matches.
var rentalStore = regexp.MustCompile(`(?i)\bstore$|^google play|^amazon video$|^microsoft|^fandango at home|^vudu|^rakuten tv$|^youtube$|^cineplex|^sky store`)

// Providers lists the streaming services in a region, most prominent first.
func (p *Picker) Providers(ctx context.Context, region string) ([]StreamingOption, error) {
	movies, err := p.tmdb.WatchProviders(ctx, "movie", region)
	if err != nil {
		return nil, err
	}
	series, err := p.tmdb.WatchProviders(ctx, "tv", region)
	if err != nil {
		return nil, err
	}
	return mergeProviders(append(movies, series...), region), nil
}

func mergeProviders(providers []tmdb.WatchProvider, region string) []StreamingOption {
	byKey := map[string]*StreamingOption{}
	var order []string
	for _, pv := range providers {
		name := serviceName(pv.ProviderName)
		key := serviceKey(name)
		if key == "" || rentalStore.MatchString(pv.ProviderName) {
			continue
		}
		priority := pv.DisplayPriority
		if pr, ok := pv.DisplayPriorities[region]; ok {
			priority = pr
		}
		o := byKey[key]
		if o == nil {
			o = &StreamingOption{Key: key, Name: name, priority: priority}
			byKey[key] = o
			order = append(order, key)
		}
		if !slices.Contains(o.providerIDs, pv.ProviderID) {
			o.providerIDs = append(o.providerIDs, pv.ProviderID)
		}
		o.priority = min(o.priority, priority)
		// Prefer the plain service's logo and name over an ad tier's or channel's.
		if (o.Logo == "" || name == pv.ProviderName) && pv.LogoPath != "" {
			o.Logo = "https://image.tmdb.org/t/p/w92" + pv.LogoPath
		}
	}
	out := make([]StreamingOption, 0, len(order))
	for _, k := range order {
		out = append(out, *byKey[k])
	}
	slices.SortStableFunc(out, func(a, b StreamingOption) int {
		return cmp.Or(cmp.Compare(a.priority, b.priority), cmp.Compare(a.Name, b.Name))
	})
	return out
}

// providerIDsFor turns service keys into TMDB provider IDs for the region.
func (p *Picker) providerIDsFor(ctx context.Context, keys []string, region string) ([]int, error) {
	options, err := p.Providers(ctx, region)
	if err != nil {
		return nil, err
	}
	var ids []int
	for _, o := range options {
		if slices.Contains(keys, o.Key) {
			ids = append(ids, o.providerIDs...)
		}
	}
	if len(ids) == 0 {
		return nil, ErrNoServices
	}
	return ids, nil
}
