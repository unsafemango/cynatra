"use client";

import { useTheme, type ThemeChoice } from "@/lib/theme";
import { Select, type SelectOption } from "./Select";

const SunIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);

const OPTIONS: SelectOption<ThemeChoice>[] = [
  { value: "system", label: "System", icon: <span aria-hidden>💻</span>, description: "Match your device" },
  { value: "light", label: "Light", icon: <span aria-hidden>☀️</span>, description: "Bright background" },
  { value: "dark", label: "Dark", icon: <span aria-hidden>🌙</span>, description: "Easy on the eyes at night" },
];

/** One-click switch in the nav bar: flips between light and dark. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, setChoice } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground ${className}`}
    >
      {/* Shows what you'd switch to, like most apps. */}
      {resolved === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

/** System / Light / Dark, for the footer and profile. */
export function ThemePicker({
  id,
  size = "md",
  className = "",
}: {
  id: string;
  size?: "md" | "sm";
  className?: string;
}) {
  const { choice, setChoice } = useTheme();
  return (
    <Select
      id={id}
      value={choice}
      onChange={setChoice}
      options={OPTIONS}
      size={size}
      align={size === "sm" ? "end" : "start"}
      className={className}
    />
  );
}
