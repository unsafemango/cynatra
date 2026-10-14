package picker

import (
	"slices"
	"testing"

	"github.com/cynatra/picker/internal/tmdb"
)

func TestMergeProviders(t *testing.T) {
	got := mergeProviders([]tmdb.WatchProvider{
		{ProviderID: 1796, ProviderName: "Netflix Standard with Ads", LogoPath: "/ads.png", DisplayPriority: 9},
		{ProviderID: 8, ProviderName: "Netflix", LogoPath: "/netflix.png", DisplayPriority: 50, DisplayPriorities: map[string]int{"CA": 0}},
		{ProviderID: 230, ProviderName: "Crave", LogoPath: "/crave.png", DisplayPriority: 3},
		{ProviderID: 8, ProviderName: "Netflix", LogoPath: "/netflix.png", DisplayPriority: 50}, // from the TV list too
		{ProviderID: 531, ProviderName: "Paramount Plus", DisplayPriority: 20},
		{ProviderID: 2303, ProviderName: "Paramount+ Amazon Channel", LogoPath: "/pchan.png", DisplayPriority: 30},
		{ProviderID: 2, ProviderName: "Apple TV Store", DisplayPriority: 1},     // rent/buy only
		{ProviderID: 3, ProviderName: "Google Play Movies", DisplayPriority: 2}, // rent/buy only
	}, "CA")

	var keys []string
	for _, o := range got {
		keys = append(keys, o.Key)
	}
	// Netflix leads (CA priority 0), then Crave (3), then Paramount (20).
	if !slices.Equal(keys, []string{"netflix", "crave", "paramount-plus"}) {
		t.Fatalf("keys = %v", keys)
	}
	n := got[0]
	if n.Name != "Netflix" || n.Logo != "https://image.tmdb.org/t/p/w92/netflix.png" || !slices.Equal(n.providerIDs, []int{1796, 8}) {
		t.Errorf("netflix = %+v (want the plain logo and both IDs once)", n)
	}
	if p := got[2]; !slices.Equal(p.providerIDs, []int{531, 2303}) || p.Logo != "https://image.tmdb.org/t/p/w92/pchan.png" {
		t.Errorf("paramount = %+v", p)
	}
}

func TestBuildQueryStreamingServices(t *testing.T) {
	q, ok := buildQuery(attempt{"movie", "movie"}, Request{Region: "CA", providerIDs: []int{8, 1796}})
	if !ok {
		t.Fatal("expected a query")
	}
	if q.Get("with_watch_providers") != "8|1796" || q.Get("watch_region") != "CA" || q.Get("with_watch_monetization_types") != "flatrate" {
		t.Errorf("query = %v", q)
	}
	if q, _ := buildQuery(attempt{"movie", "movie"}, Request{Region: "CA"}); q.Has("with_watch_providers") || q.Has("watch_region") {
		t.Errorf("no services: no provider filter, got %v", q)
	}
}

func TestNormalizeServices(t *testing.T) {
	r := Request{Services: []string{"netflix", "crave"}}
	if err := Normalize(&r); err != nil {
		t.Fatal(err)
	}
	for _, bad := range [][]string{{"Netflix!"}, {""}, make([]string, 31)} {
		r := Request{Services: bad}
		if Normalize(&r) == nil {
			t.Errorf("Normalize accepted services %q", bad)
		}
	}
}
