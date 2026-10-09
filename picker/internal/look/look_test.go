package look

import (
	"image"
	"image/color"
	"testing"
)

func fill(w, h int, at func(x, y int) color.RGBA) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.SetRGBA(x, y, at(x, y))
		}
	}
	return img
}

func TestMeasureGreyIsNotColourful(t *testing.T) {
	s := Measure(fill(40, 20, func(int, int) color.RGBA { return color.RGBA{128, 128, 128, 255} }))
	if s.Colorfulness > 1 || s.HueVariety != 0 {
		t.Errorf("grey: %+v", s)
	}
}

func TestMeasureTintedImageHasOneHue(t *testing.T) {
	s := Measure(fill(40, 20, func(x, _ int) color.RGBA { return color.RGBA{230, uint8(110 + x), 30, 255} }))
	if s.HueVariety > 2 {
		t.Errorf("orange tint should be 1–2 hue families: %+v", s)
	}
}

func TestMeasureRainbowIsBrightAndColourful(t *testing.T) {
	stripes := []color.RGBA{{240, 60, 60, 255}, {250, 200, 40, 255}, {70, 200, 90, 255}, {60, 140, 240, 255}, {200, 80, 220, 255}}
	s := Measure(fill(50, 20, func(x, _ int) color.RGBA { return stripes[x/10] }))
	if s.HueVariety < 4 || !BrightAndColorful(s) {
		t.Errorf("rainbow: %+v", s)
	}
}

// Scores measured from real TMDB backdrop + poster pairs during calibration.
func TestCalibrationExamples(t *testing.T) {
	cases := []struct {
		name string
		want bool
		imgs []Score
	}{
		{"Barbie", true, []Score{{158, 148, 4}, {144, 183, 4}}},
		{"Encanto", true, []Score{{73, 86, 5}, {64, 84, 7}}},
		{"Paddington 2", true, []Score{{57, 67, 3}, {81, 77, 3}}},
		{"Oppenheimer", false, []Score{{76, 129, 2}, {84, 50, 2}}},
		{"Breaking Bad", false, []Score{{70, 118, 4}, {38, 59, 4}}},
		{"The Batman", false, []Score{{118, 52, 2}, {93, 77, 2}}},
		{"Sicario", false, []Score{{28, 172, 2}, {30, 146, 2}}},
	}
	for _, c := range cases {
		if got := BrightAndColorful(c.imgs...); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
	if BrightAndColorful() {
		t.Error("no images should not pass")
	}
}
