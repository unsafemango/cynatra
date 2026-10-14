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
