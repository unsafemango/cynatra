// Shared with the server layout, so it can't live in a "use client" file.

export const THEME_KEY = "cynatra:theme";

// The staging site's tab icon: the logo in staging's purple.
const STAGING_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="16" fill="#8b5cf6"/><circle cx="24" cy="20" r="7.5" fill="#FFF8F2"/><circle cx="24" cy="44" r="7.5" fill="#FFF8F2"/><circle cx="46" cy="32" r="7.5" fill="#FFF8F2"/></svg>',
  );

/**
 * Runs in <head> before the first paint (see app/layout.tsx), so a saved
 * theme never flashes the other one. Also marks staging (staging.cynatra.app)
 * with data-env="staging", which turns the accent purple (globals.css), and
 * gives it a purple tab icon. Keep it tiny and dependency-free.
 */
export const THEME_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t)}catch(e){}if(location.hostname.indexOf("staging.")===0){d.setAttribute("data-env","staging");document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll('link[rel~="icon"]').forEach(function(l){l.href=${JSON.stringify(STAGING_ICON)}})})}})()`;
