// Package look scores how bright and colourful a title looks, from one of its
// images (a backdrop still, or the poster when there is none).
package look

import (
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg" // TMDB images are JPEGs
	_ "image/png"
	"math"
	"net/http"
	"time"

	"github.com/cynatra/picker/internal/cache"
)

// Score is an image's colourfulness (Hasler & Süsstrunk, 2003: ~0 grey,
// 33 moderately, 45 averagely, 59 quite, 82+ highly colourful) and its mean
// brightness (0 black … 255 white).
type Score struct {
	Colorfulness float64 `json:"c"`
	Brightness   float64 `json:"b"`
	// HueVariety counts the 30° hue families that each cover ≥6% of the
	// image's clearly coloured pixels: 1–2 for a tinted image (all orange),
	// 4+ for a genuinely multicoloured one.
	HueVariety int `json:"h"`
}

// Thresholds for "bright & colourful", calibrated on real TMDB images
// (backdrop + poster) of 12 vivid titles (Barbie, Spider-Verse, Bluey, Encanto…)
// and 12 dark ones (The Batman, Se7en, Oppenheimer, Breaking Bad…): 10 of the
// vivid ones pass and none of the dark ones. Tinted images (all desert orange,
// all fire) are kept out by requiring several hue families.
const (
	MinColorfulness = 58
	MinBrightness   = 70
	MinHueVariety   = 3
)

// BrightAndColorful judges a title from its images (backdrop and/or poster):
// averaged colourfulness and brightness, and enough distinct hues in at least one.
func BrightAndColorful(scores ...Score) bool {
	if len(scores) == 0 {
		return false
	}
	var c, b float64
	variety := 0
	for _, s := range scores {
		c += s.Colorfulness
		b += s.Brightness
		variety = max(variety, s.HueVariety)
	}
	n := float64(len(scores))
	return c/n >= MinColorfulness && b/n >= MinBrightness && variety >= MinHueVariety
}

// Measure computes the score of a decoded image.
func Measure(img image.Image) Score {
	b := img.Bounds()
	// Every other pixel in each direction is plenty for a 300px-wide still.
	var n, sumRG, sumYB, sumRG2, sumYB2, sumL float64
	var hues [12]float64
	var colored float64
	for y := b.Min.Y; y < b.Max.Y; y += 2 {
		for x := b.Min.X; x < b.Max.X; x += 2 {
			r16, g16, b16, _ := img.At(x, y).RGBA()
			r, g, bl := float64(r16>>8), float64(g16>>8), float64(b16>>8)
			rg := r - g
			yb := 0.5*(r+g) - bl
			sumRG += rg
			sumYB += yb
			sumRG2 += rg * rg
			sumYB2 += yb * yb
			sumL += 0.2126*r + 0.7152*g + 0.0722*bl
			n++
			if h, ok := hueOf(r, g, bl); ok {
				hues[int(h/30)%12]++
				colored++
			}
		}
	}
	if n == 0 {
		return Score{}
	}
	meanRG, meanYB := sumRG/n, sumYB/n
	varRG := math.Max(0, sumRG2/n-meanRG*meanRG)
	varYB := math.Max(0, sumYB2/n-meanYB*meanYB)
	variety := 0
	for _, c := range hues {
		if colored > 0 && c/colored >= 0.06 {
			variety++
		}
	}
	return Score{
		Colorfulness: math.Sqrt(varRG+varYB) + 0.3*math.Sqrt(meanRG*meanRG+meanYB*meanYB),
		Brightness:   sumL / n,
		HueVariety:   variety,
	}
}

// hueOf returns the hue (0–360°) of a clearly coloured pixel: saturated and
// not too dark. Greys, near-blacks and washed-out pixels don't count.
func hueOf(r, g, b float64) (float64, bool) {
	maxC := math.Max(r, math.Max(g, b))
	minC := math.Min(r, math.Min(g, b))
	d := maxC - minC
	if maxC < 60 || d/maxC < 0.3 {
		return 0, false
	}
	var h float64
	switch maxC {
	case r:
		h = math.Mod((g-b)/d, 6)
	case g:
		h = (b-r)/d + 2
	default:
		h = (r-g)/d + 4
	}
	h *= 60
	if h < 0 {
		h += 360
	}
	return h, true
}

// Scorer fetches TMDB images and caches their scores (a still never changes).
type Scorer struct {
	http  *http.Client
	cache cache.Cache
}

func NewScorer(c cache.Cache) *Scorer {
	return &Scorer{http: &http.Client{Timeout: 8 * time.Second}, cache: c}
}

const cacheTTL = 30 * 24 * time.Hour

// ScorePath scores a TMDB image path such as "/abc123.jpg" (a small size is fetched).
func (s *Scorer) ScorePath(ctx context.Context, path string) (Score, error) {
	key := "look:v2:" + path
	if b, ok := s.cache.Get(ctx, key); ok {
		var sc Score
		if json.Unmarshal(b, &sc) == nil {
			return sc, nil
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://image.tmdb.org/t/p/w300"+path, nil)
	if err != nil {
		return Score{}, err
	}
	resp, err := s.http.Do(req)
	if err != nil {
		return Score{}, fmt.Errorf("fetch image: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Score{}, fmt.Errorf("fetch image: status %d", resp.StatusCode)
	}
	img, _, err := image.Decode(resp.Body)
	if err != nil {
		return Score{}, fmt.Errorf("decode image: %w", err)
	}
	sc := Measure(img)
	if b, err := json.Marshal(sc); err == nil {
		s.cache.Set(ctx, key, b, cacheTTL)
	}
	return sc, nil
}
