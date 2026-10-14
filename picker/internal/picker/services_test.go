package picker

import (
	"slices"
	"testing"
)

func TestServiceName(t *testing.T) {
	cases := map[string]string{
		"Netflix":                         "Netflix",
		"Netflix basic with Ads":          "Netflix",
		"Netflix Standard with Ads":       "Netflix",
		"Amazon Prime Video with Ads":     "Amazon Prime Video",
		"HBO Max Amazon Channel":          "HBO Max",
		"Paramount Plus Apple TV Channel": "Paramount Plus",
		"Peacock Premium Plus":            "Peacock",
		"Peacock Premium":                 "Peacock",
		"Paramount Plus Essential":        "Paramount Plus",
		"Crave":                           "Crave",
	}
	for in, want := range cases {
		if got := serviceName(in); got != want {
			t.Errorf("serviceName(%q) = %q, want %q", in, got, want)
		}
	}
	if serviceKey("Disney Plus") != "disney-plus" || serviceKey("Apple TV+") != "apple-tv" {
		t.Errorf("serviceKey: %q %q", serviceKey("Disney Plus"), serviceKey("Apple TV+"))
	}
}

func streaming(id string, providers ...string) *Title {
	t := &Title{ID: id, Title: id, WhereToWatch: &WhereToWatch{}}
	for _, p := range providers {
		t.WhereToWatch.Stream = append(t.WhereToWatch.Stream, Provider{Name: p, Logo: "https://img/" + p})
	}
	return t
}

func TestBuildServicesReport(t *testing.T) {
	r := buildServicesReport([]*Title{
		streaming("a", "Netflix", "Netflix Standard with Ads"), // same service twice
		streaming("b", "Netflix", "Max"),
		streaming("c", "Netflix"),
		streaming("d", "Max Amazon Channel"), // only on Max (via a channel)
		streaming("e", "Disney Plus"),
		streaming("f"), // rent/buy only
	})

	if r.Total != 6 || r.Streamable != 5 {
		t.Errorf("total/streamable = %d/%d", r.Total, r.Streamable)
	}
	byKey := map[string]Service{}
	for _, s := range r.Services {
		byKey[s.Key] = s
	}
	if n := byKey["netflix"]; !slices.Equal(n.Titles, []string{"a", "b", "c"}) || !slices.Equal(n.Unique, []string{"a", "c"}) {
		t.Errorf("netflix = %+v", n)
	}
	// Max's logo comes from the plain service, not the Amazon channel.
	if m := byKey["max"]; !slices.Equal(m.Titles, []string{"b", "d"}) || !slices.Equal(m.Unique, []string{"d"}) || m.Logo != "https://img/Max" {
		t.Errorf("max = %+v", m)
	}
	if r.Services[0].Key != "netflix" {
		t.Errorf("most titles first, got %s", r.Services[0].Key)
	}

	// Netflix covers 3, then Max adds d, then Disney+ adds e.
	want := []PlanStep{{"netflix", 3, 3}, {"max", 1, 4}, {"disney-plus", 1, 5}}
	if !slices.Equal(r.Plan, want) {
		t.Errorf("plan = %+v, want %+v", r.Plan, want)
	}
	if f := r.Titles[5]; f.ID != "f" || len(f.Services) != 0 {
		t.Errorf("rent-only title = %+v", f)
	}
}

func TestBuildServicesReportEmpty(t *testing.T) {
	r := buildServicesReport(nil)
	if r.Total != 0 || len(r.Plan) != 0 || r.Services == nil || r.Titles == nil {
		t.Errorf("empty report = %+v", r)
	}
}
