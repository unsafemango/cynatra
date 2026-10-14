package picker

import (
	"cmp"
	"context"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
)

// The streaming-services report: for the titles someone wants to watch, which
// subscription services carry them, which titles only one service has, and
// the smallest combination of services that covers the most.

// ServiceTitle is a title in the report and the services streaming it.
type ServiceTitle struct {
	SearchHit
	Services []string `json:"services"` // service keys
}

// Service is one subscription service (ad tiers and add-on channels merged in).
type Service struct {
	Key    string   `json:"key"` // e.g. "netflix"
	Name   string   `json:"name"`
	Logo   string   `json:"logo,omitempty"`
	Titles []string `json:"titles"` // title IDs on this service
	Unique []string `json:"unique"` // title IDs no other service has
}

// PlanStep adds one service to the best combination.
type PlanStep struct {
	Key     string `json:"key"`
	Added   int    `json:"added"`   // titles it adds
	Covered int    `json:"covered"` // titles covered so far
}

type ServicesReport struct {
	Region     string         `json:"region"`
	Total      int            `json:"total"`      // titles looked at
	Streamable int            `json:"streamable"` // on at least one service
	Titles     []ServiceTitle `json:"titles"`
	Services   []Service      `json:"services"` // most titles first
	Plan       []PlanStep     `json:"plan"`     // best combination, in order
}

// MaxServicesTitles caps how many titles one report looks up.
const MaxServicesTitles = 200

// maxPlanSteps keeps the suggested combination to a sensible size.
const maxPlanSteps = 6

// Services builds the report for titles ("movie:603") in a region.
// Titles that can't be looked up are left out.
func (p *Picker) Services(ctx context.Context, ids []string, region string) *ServicesReport {
	region = strings.ToUpper(region)
	titles := make([]*Title, len(ids))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)
	for i, id := range ids {
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
			if t, err := p.details(ctx, attempt{kind, media}, n, region); err == nil {
				markAnimation(t)
				titles[i] = t
			}
		})
	}
	wg.Wait()
	report := buildServicesReport(slices.DeleteFunc(titles, func(t *Title) bool { return t == nil }))
	report.Region = region
	return report
}

// Ad tiers, plan names and add-on channels that are the same service for
// this purpose: "Netflix Standard with Ads" and "HBO Max Amazon Channel"
// count as Netflix and HBO Max.
var serviceSuffix = regexp.MustCompile(
	`(?i)\s+(?:(?:standard|basic|premium)\s+)?with\s+ads$|\s+(?:amazon|apple\s+tv|roku\s+premium)\s+channel$|\s+premium(?:\s+plus)?$|\s+essential$`,
)

// serviceName is the service a provider belongs to, e.g. "Netflix basic with Ads" -> "Netflix".
func serviceName(provider string) string {
	name := strings.TrimSpace(provider)
	for {
		trimmed := strings.TrimSpace(serviceSuffix.ReplaceAllString(name, ""))
		if trimmed == name || trimmed == "" {
			return name
		}
		name = trimmed
	}
}

var nonKey = regexp.MustCompile(`[^a-z0-9]+`)

func serviceKey(name string) string {
	return strings.Trim(nonKey.ReplaceAllString(strings.ToLower(name), "-"), "-")
}

func buildServicesReport(titles []*Title) *ServicesReport {
	r := &ServicesReport{Total: len(titles), Titles: []ServiceTitle{}, Services: []Service{}, Plan: []PlanStep{}}
	services := map[string]*Service{}
	logoIsBase := map[string]bool{} // prefer the plain service's logo over a channel's

	for _, t := range titles {
		st := ServiceTitle{
			SearchHit: SearchHit{ID: t.ID, TMDBID: t.TMDBID, MediaType: t.MediaType, Kind: t.Kind, Title: t.Title, Year: t.Year},
			Services:  []string{},
		}
		if t.PosterURL != "" {
			st.PosterURL = strings.Replace(t.PosterURL, "/w500/", "/w185/", 1)
		}
		if t.WhereToWatch != nil {
			for _, pv := range t.WhereToWatch.Stream {
				name := serviceName(pv.Name)
				key := serviceKey(name)
				if key == "" || slices.Contains(st.Services, key) {
					continue
				}
				st.Services = append(st.Services, key)
				s := services[key]
				if s == nil {
					s = &Service{Key: key, Name: name, Titles: []string{}, Unique: []string{}}
					services[key] = s
				}
				if !logoIsBase[key] {
					s.Logo = pv.Logo
					logoIsBase[key] = name == pv.Name
				}
				s.Titles = append(s.Titles, t.ID)
			}
		}
		if len(st.Services) > 0 {
			r.Streamable++
		}
		if len(st.Services) == 1 {
			services[st.Services[0]].Unique = append(services[st.Services[0]].Unique, t.ID)
		}
		r.Titles = append(r.Titles, st)
	}

	for _, s := range services {
		r.Services = append(r.Services, *s)
	}
	slices.SortFunc(r.Services, func(a, b Service) int {
		return cmp.Or(cmp.Compare(len(b.Titles), len(a.Titles)), cmp.Compare(len(b.Unique), len(a.Unique)), cmp.Compare(a.Name, b.Name))
	})

	// Best combination: repeatedly add the service that covers the most titles
	// not covered yet (greedy set cover; ties go to the bigger service).
	covered := map[string]bool{}
	for len(r.Plan) < maxPlanSteps {
		var best *Service
		bestGain := 0
		for i := range r.Services {
			s := &r.Services[i]
			gain := 0
			for _, id := range s.Titles {
				if !covered[id] {
					gain++
				}
			}
			if gain > bestGain {
				best, bestGain = s, gain
			}
		}
		if best == nil {
			break
		}
		for _, id := range best.Titles {
			covered[id] = true
		}
		r.Plan = append(r.Plan, PlanStep{Key: best.Key, Added: bestGain, Covered: len(covered)})
	}
	return r
}
