"use client";

import { useEffect, useState } from "react";
import { api, type ProviderOption } from "./api";
import { useAuth } from "./auth";
import { guessRegion } from "./regions";

/**
 * The viewer's where-to-watch country: their profile's when logged in, else a
 * guess (time zone, then language, then Canada). null until known (after
 * mount, once login is restored), so the server's render is kept until then.
 */
export function useViewerRegion(): string | null {
  const { user, ready } = useAuth();
  const [guess, setGuess] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setGuess(guessRegion()), []);
  if (!ready) return null;
  return user?.region ?? guess;
}

// One request per country, shared by everything on the page that asks.
const servicesByRegion = new Map<string, Promise<string[]>>();

/** Keys of the streaming services offered in a country (e.g. "netflix"). */
export function regionServiceKeys(region: string): Promise<string[]> {
  let keys = servicesByRegion.get(region);
  if (!keys) {
    keys = api<ProviderOption[]>(`/api/providers?region=${region}`).then((p) => p.map((s) => s.key));
    // A failed lookup is retried next time rather than remembered.
    keys.catch(() => servicesByRegion.delete(region));
    servicesByRegion.set(region, keys);
  }
  return keys;
}

/**
 * Whether a streaming service is offered in a country: undefined while
 * checking (or with no service/country), then true or false. Assumes yes if
 * the check itself fails, so a hiccup never hides a page's spin.
 */
export function useServiceAvailable(serviceKey: string | undefined, region: string | null) {
  const [result, setResult] = useState<{ key: string; available: boolean } | null>(null);
  const lookup = serviceKey && region ? `${serviceKey}|${region}` : null;
  useEffect(() => {
    if (!serviceKey || !region || !lookup) return;
    let live = true;
    regionServiceKeys(region)
      .then((keys) => live && setResult({ key: lookup, available: keys.includes(serviceKey) }))
      .catch(() => live && setResult({ key: lookup, available: true }));
    return () => {
      live = false;
    };
  }, [serviceKey, region, lookup]);
  return result?.key === lookup ? result.available : undefined;
}
