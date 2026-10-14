"use client";

import { useRatingSource, type RatingSource } from "@/lib/ratings";
import { SourceBadge } from "./Rating";
import { Select, type SelectOption } from "./Select";

const OPTIONS: SelectOption<RatingSource>[] = [
  {
    value: "imdb",
    label: "IMDb rating",
    icon: <SourceBadge source="imdb" />,
    description: "From IMDb users (default)",
  },
  {
    value: "tmdb",
    label: "TMDB score",
    icon: <SourceBadge source="tmdb" />,
    description: "From The Movie Database community",
  },
];

/** Choose which rating the site shows (IMDb by default). */
export function RatingSourcePicker({ id, size = "md" }: { id: string; size?: "md" | "sm" }) {
  const [source, setSource] = useRatingSource();
  return (
    <Select
      id={id}
      value={source}
      onChange={setSource}
      options={OPTIONS}
      size={size}
      align={size === "sm" ? "end" : "start"}
      className={size === "md" ? "w-full sm:max-w-xs" : ""}
    />
  );
}
