// Countries a user can pick for "where you watch" (streaming availability).
export const REGIONS = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["IE", "Ireland"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
  ["IN", "India"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["BR", "Brazil"],
  ["MX", "Mexico"],
  ["NG", "Nigeria"],
  ["ZA", "South Africa"],
] as const;

/** Country name for a code, e.g. "CA" -> "Canada" (the code itself if unknown). */
export const regionName = (code: string) => REGIONS.find(([c]) => c === code)?.[1] ?? code;

// "US" -> 🇺🇸 (regional indicator letters).
export const flag = (code: string) => String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));

/** Where-to-watch country when we don't know the visitor's: Canada, where Cynatra is made. */
export const DEFAULT_REGION = "CA";

// Time zones in Canada. Most Canadian browsers report "en-US" as their language,
// so the time zone is the better clue there.
const CANADIAN_TIME_ZONES = new Set(
  (
    "Toronto Montreal Vancouver Edmonton Winnipeg Halifax St_Johns Regina Moncton Glace_Bay Goose_Bay " +
    "Whitehorse Dawson Dawson_Creek Fort_Nelson Yellowknife Inuvik Cambridge_Bay Rankin_Inlet Resolute " +
    "Iqaluit Swift_Current Creston Atikokan Blanc-Sablon Nipigon Thunder_Bay Rainy_River Pangnirtung Coral_Harbour"
  )
    .split(" ")
    .map((city) => `America/${city}`),
);

/**
 * Best guess at a logged-out visitor's country: Canada for a Canadian time zone,
 * else the browser language's country (e.g. "en-GB" -> "GB") if we support it,
 * else Canada.
 */
export function guessRegion(): string {
  if (typeof navigator === "undefined") return DEFAULT_REGION;
  try {
    if (CANADIAN_TIME_ZONES.has(Intl.DateTimeFormat().resolvedOptions().timeZone)) return "CA";
  } catch {
    // no Intl time zone: fall through to the languages
  }
  for (const lang of navigator.languages ?? [navigator.language]) {
    const region = lang.split("-")[1]?.toUpperCase();
    if (region && REGIONS.some(([code]) => code === region)) return region;
  }
  return DEFAULT_REGION;
}
