import { Suspense } from "react";
import { PersonView } from "./PersonView";

export default function PersonPage() {
  // Route params are request-time data, so the client view renders inside Suspense.
  return (
    <Suspense fallback={<div className="h-[360px] rounded-2xl bg-surface border border-border animate-pulse" />}>
      <PersonView />
    </Suspense>
  );
}
