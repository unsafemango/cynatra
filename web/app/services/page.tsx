"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PosterTile } from "@/components/PosterTile";
import { api, type ServicesReport, type StreamingService, type Subscription } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { flag, regionName } from "@/lib/regions";

const money = (n: number) => n.toFixed(2).replace(/\.00$/, "");

/** "Which streaming services do I actually need?" for the titles on your Watchlist and Watching. */
export default function ServicesPage() {
  const { user, ready } = useAuth();
  const [report, setReport] = useState<ServicesReport | null>(null);
  const [subscribed, setSubscribed] = useState<Subscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!ready || !user) return;
    api<{ report: ServicesReport; subscribed: Subscription[] }>("/api/me/services")
      .then((r) => {
        setReport(r.report);
        setSubscribed(r.subscribed);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your services."));
  }, [ready, user]);

  // Saves shortly after the last change (prices are typed).
  const update = (next: Subscription[]) => {
    setSubscribed(next);
    setSaveError(null);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api("/api/me/services", { method: "PUT", body: JSON.stringify({ subscribed: next }) }).catch((e) =>
        setSaveError(e instanceof Error ? e.message : "Couldn't save."),
      );
    }, 600);
  };

  if (ready && !user) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-border bg-surface p-8 text-center">
        <h1 className="text-xl font-semibold">Which streaming services do you actually need?</h1>
        <p className="mt-2 text-muted">
          Log in and add titles to your watchlist; we&apos;ll work out which services cover them, and which you could
          drop.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 font-medium text-white hover:brightness-110"
        >
          Log in
        </Link>
      </div>
    );
  }
  if (error) return <p className="pt-12 text-center text-muted">{error}</p>;
  if (!report) return <div className="h-[420px] rounded-3xl border border-border bg-surface animate-pulse" />;

  const byKey = new Map(report.services.map((s) => [s.key, s]));
  const titleById = new Map(report.titles.map((t) => [t.id, t]));
  const notStreaming = report.titles.filter((t) => t.services.length === 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your streaming services</h1>
        <p className="mt-1.5 text-muted">
          Based on the {report.total} title{report.total === 1 ? "" : "s"} on your{" "}
          <Link href="/library" className="text-foreground hover:underline underline-offset-4">
            Watchlist and Watching
          </Link>
          , streaming in {flag(report.region)} {regionName(report.region)}.{" "}
          <Link href="/profile" className="hover:text-foreground hover:underline underline-offset-4">
            Change country
          </Link>
        </p>
      </header>

      {report.total === 0 ? (
        <Empty />
      ) : (
        <>
          <Advice report={report} byKey={byKey} subscribed={subscribed} />
          <BestCombination report={report} byKey={byKey} />
          <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Every service on your list</h2>
            <p className="mt-0.5 text-sm text-muted">
              Tick the ones you pay for (and what they cost, if you like) to see what you could drop.
              {saveError && <span className="ml-2 text-accent">{saveError}</span>}
            </p>
            <ul className="mt-4 divide-y divide-border">
              {report.services.map((s) => (
                <ServiceRow
                  key={s.key}
                  service={s}
                  total={report.total}
                  titleById={titleById}
                  subscription={subscribed.find((x) => x.key === s.key)}
                  onChange={(sub) =>
                    update(
                      sub
                        ? [...subscribed.filter((x) => x.key !== s.key), sub]
                        : subscribed.filter((x) => x.key !== s.key),
                    )
                  }
                />
              ))}
            </ul>
          </section>
          {notStreaming.length > 0 && (
            <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Not on any subscription</h2>
              <p className="mt-0.5 text-sm text-muted">
                {notStreaming.length} title{notStreaming.length === 1 ? " is" : "s are"} only available to rent or buy
                in {regionName(report.region)} right now.
              </p>
              <ul className="mt-4 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-6">
                {notStreaming.map((t) => (
                  <li key={t.id}>
                    <PosterTile hit={t} sizes="(max-width: 640px) 30vw, 120px" />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-3xl border border-border bg-surface p-8 text-center">
      <p className="text-lg">Nothing to compare yet.</p>
      <p className="mt-1 text-muted">
        Add titles to your watchlist (from a{" "}
        <Link href="/" className="text-foreground underline underline-offset-4">
          spin
        </Link>{" "}
        or{" "}
        <Link href="/search" className="text-foreground underline underline-offset-4">
          search
        </Link>
        ) and come back.
      </p>
    </div>
  );
}

function Logo({ service, size = 36 }: { service?: StreamingService; size?: number }) {
  return service?.logo ? (
    <Image src={service.logo} alt="" width={size} height={size} className="shrink-0 rounded-lg" />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-lg bg-surface-2 text-xs text-muted"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {service?.name.charAt(0)}
    </span>
  );
}

/** What to keep, drop or add, given what the user pays for. */
function Advice({
  report,
  byKey,
  subscribed,
}: {
  report: ServicesReport;
  byKey: Map<string, StreamingService>;
  subscribed: Subscription[];
}) {
  if (subscribed.length === 0) return null;

  // Drop the dearest first: a service can go if everything of yours on it is
  // also on a service you're keeping.
  const keep = new Set(subscribed.map((s) => s.key));
  const droppable: Subscription[] = [];
  for (const sub of [...subscribed].sort((a, b) => (b.price ?? 0) - (a.price ?? 0))) {
    const service = byKey.get(sub.key);
    const others = [...keep].filter((k) => k !== sub.key);
    const coveredElsewhere = (service?.titles ?? []).every((id) =>
      others.some((k) => byKey.get(k)?.titles.includes(id)),
    );
    if (coveredElsewhere) {
      droppable.push(sub);
      keep.delete(sub.key);
    }
  }
  const saving = droppable.reduce((sum, s) => sum + (s.price ?? 0), 0);

  // What the user can't watch with what they pay for, and the best service to add for it.
  const covered = new Set([...keep].flatMap((k) => byKey.get(k)?.titles ?? []));
  const missing = report.titles.filter((t) => t.services.length > 0 && !covered.has(t.id));
  const bestAdd = report.services
    .filter((s) => !keep.has(s.key))
    .map((s) => ({ s, gain: s.titles.filter((id) => missing.some((m) => m.id === id)).length }))
    .sort((a, b) => b.gain - a.gain)[0];

  return (
    <section className="rounded-3xl border border-accent-2/30 bg-accent-2/5 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Our advice</h2>
      <ul className="mt-3 space-y-2.5 text-[15px]">
        {droppable.length > 0 ? (
          <li>
            💸 You could drop <strong>{droppable.map((d) => byKey.get(d.key)?.name ?? d.key).join(" and ")}</strong>
            {saving > 0 && (
              <>
                {" "}
                and save <strong>{money(saving)}/month</strong> ({money(saving * 12)}/year)
              </>
            )}
            : nothing on your list is only there.
          </li>
        ) : (
          <li>✅ Every service you pay for has something on your list that the others don&apos;t.</li>
        )}
        {missing.length > 0 ? (
          <li>
            📺 {missing.length} title{missing.length === 1 ? " isn't" : "s aren't"} on the services you keep.
            {bestAdd && bestAdd.gain > 0 && (
              <>
                {" "}
                <strong>{bestAdd.s.name}</strong> has {bestAdd.gain} of them.
              </>
            )}
          </li>
        ) : (
          <li>🎉 You can stream everything on your list with the services you keep.</li>
        )}
      </ul>
    </section>
  );
}

function BestCombination({ report, byKey }: { report: ServicesReport; byKey: Map<string, StreamingService> }) {
  if (report.plan.length === 0) {
    return (
      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Best combination</h2>
        <p className="mt-1 text-sm text-muted">None of your titles are on a subscription service here right now.</p>
      </section>
    );
  }
  const last = report.plan.at(-1)!;
  return (
    <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Best combination</h2>
      <p className="mt-0.5 text-sm text-muted">
        The fewest services that cover the most of your list: {last.covered} of {report.total} titles with{" "}
        {report.plan.length} service{report.plan.length === 1 ? "" : "s"}.
      </p>
      <ol className="mt-4 space-y-3">
        {report.plan.map((step, i) => {
          const s = byKey.get(step.key);
          const pct = Math.round((step.covered / report.total) * 100);
          return (
            <li key={step.key} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted">{i + 1}.</span>
              <Logo service={s} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium">
                    {i > 0 && <span className="text-muted">+ </span>}
                    {s?.name ?? step.key}
                  </p>
                  <p className="shrink-0 text-sm tabular-nums text-muted">
                    +{step.added} · <span className="text-foreground">{pct}%</span>
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ServiceRow({
  service: s,
  total,
  titleById,
  subscription,
  onChange,
}: {
  service: StreamingService;
  total: number;
  titleById: Map<string, ServicesReport["titles"][number]>;
  subscription?: Subscription;
  onChange: (sub: Subscription | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const paying = Boolean(subscription);
  return (
    <li className="py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <Logo service={s} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{s.name}</p>
          <p className="text-sm text-muted">
            {s.titles.length} of your {total} title{total === 1 ? "" : "s"}
            {s.unique.length > 0 ? (
              <>
                {" "}
                · <span className="text-accent-2">{s.unique.length} only here</span>
              </>
            ) : (
              " · all also elsewhere"
            )}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={paying}
            onChange={(e) => onChange(e.target.checked ? { key: s.key } : null)}
            className="size-4 accent-[var(--accent)]"
          />
          I pay for this
        </label>
        <label className={`flex items-center gap-1.5 text-sm ${paying ? "" : "invisible"}`}>
          <span className="sr-only">Monthly cost of {s.name}</span>
          <input
            type="number"
            min={0}
            max={500}
            step="0.01"
            inputMode="decimal"
            placeholder="Cost"
            value={subscription?.price ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? undefined : Math.min(500, Math.max(0, Number(e.target.value)));
              onChange({ key: s.key, price: v });
            }}
            tabIndex={paying ? 0 : -1}
            className="w-20 rounded-lg border border-border bg-background/60 px-2 py-1.5 text-right tabular-nums focus:border-accent focus:outline-none"
          />
          <span className="text-muted">/mo</span>
        </label>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="text-sm text-muted hover:text-foreground"
        >
          {open ? "Hide titles" : "Show titles"}
        </button>
      </div>
      {open && (
        <ul className="mt-3 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-6">
          {s.titles.map((id) => {
            const t = titleById.get(id);
            return (
              t && (
                <li key={id} className="relative">
                  <PosterTile hit={t} sizes="(max-width: 640px) 30vw, 120px" />
                  {s.unique.includes(id) && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-accent-2 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                      Only here
                    </span>
                  )}
                </li>
              )
            );
          })}
        </ul>
      )}
    </li>
  );
}
