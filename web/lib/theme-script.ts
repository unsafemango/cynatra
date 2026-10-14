// Shared with the server layout, so it can't live in a "use client" file.

export const THEME_KEY = "cynatra:theme";

/**
 * Runs in <head> before the first paint (see app/layout.tsx), so a saved
 * theme never flashes the other one. Keep it tiny and dependency-free.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
