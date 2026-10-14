"use client";

import { useState } from "react";
import { CheckIcon, LockIcon, Spinner } from "@/components/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Select, type SelectOption } from "@/components/Select";

// Values must match the gateway's SUPPORT_TOPICS.
const TOPICS = [
  { value: "Account & sign-in", icon: "🔐", description: "Logging in, sign-up codes, Google sign-in" },
  { value: "Spins & recommendations", icon: "🎲", description: "Picks, filters, ratings, where to watch" },
  { value: "Something isn't working", icon: "🐞", description: "Errors or things that look wrong" },
  { value: "Feature idea", icon: "💡", description: "Something you'd like Cynatra to do" },
  { value: "Other", icon: "💬", description: "Anything else" },
] as const;
type Topic = (typeof TOPICS)[number]["value"];

const TOPIC_OPTIONS: SelectOption<Topic>[] = TOPICS.map((t) => ({
  value: t.value,
  label: t.value,
  icon: (
    <span className="text-base leading-none" aria-hidden>
      {t.icon}
    </span>
  ),
  description: t.description,
}));

const MAX_MESSAGE = 5000;

const field =
  "w-full rounded-xl border border-border bg-background/60 px-3.5 py-3 placeholder:text-muted/60 hover:border-muted/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-70";

/** Sends a message to the support inbox; replies come back by email. */
export function ContactForm() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  // Logged-out visitors type an email; logged in, replies go to the account's.
  const [typedEmail, setTypedEmail] = useState("");
  const [topic, setTopic] = useState<Topic>(TOPICS[0].value);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string }>({
    kind: "idle",
  });
  const emailValue = user?.email ?? typedEmail;
  const sending = state.kind === "sending";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: "sending" });
    try {
      await api("/api/support", {
        method: "POST",
        // Logged in, the server uses the account's email.
        body: JSON.stringify({
          name: name || undefined,
          email: user ? undefined : typedEmail,
          topic,
          message,
          website,
        }),
      });
      setState({ kind: "sent" });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Couldn't send your message." });
    }
  };

  if (state.kind === "sent") {
    return (
      <div role="status" className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
        <p className="flex items-center gap-2 font-medium text-emerald-300">
          <CheckIcon width={18} height={18} /> Message sent
        </p>
        <p className="mt-1 text-sm text-foreground/85">
          Thanks! We&apos;ll reply to <span className="font-medium">{emailValue}</span>. Keep an eye on Spam just in
          case.
        </p>
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setState({ kind: "idle" });
          }}
          className="mt-3 text-sm text-muted hover:text-foreground"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Name (optional)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="name"
            disabled={sending}
            className={field}
          />
        </label>
        {user ? (
          <div className="block text-sm">
            <span className="mb-1.5 block text-muted">Your email</span>
            <p
              className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3.5 py-3 text-foreground/90"
              title="Replies go to the email on your account"
            >
              <LockIcon width={16} height={16} className="shrink-0 text-muted" />
              <span className="truncate">{user.email}</span>
            </p>
          </div>
        ) : (
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">Your email</span>
            <input
              type="email"
              required
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              maxLength={254}
              autoComplete="email"
              disabled={sending}
              className={field}
            />
          </label>
        )}
      </div>

      {/* Not a <label>: clicks inside the open list would re-toggle the button. */}
      <div className="text-sm">
        <span id="support-topic-label" className="mb-1.5 block text-muted">
          Topic
        </span>
        <Select
          aria-labelledby="support-topic-label"
          value={topic}
          onChange={setTopic}
          options={TOPIC_OPTIONS}
          disabled={sending}
        />
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 flex justify-between text-muted">
          Message
          <span className="tabular-nums text-muted/70">
            {message.length}/{MAX_MESSAGE}
          </span>
        </span>
        <textarea
          required
          minLength={10}
          maxLength={MAX_MESSAGE}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What happened, or what would you like to see? For problems, the title or page involved helps."
          disabled={sending}
          className={`${field} resize-y`}
        />
      </label>

      {/* Honeypot: hidden from people, often filled in by spam bots. */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-medium text-white hover:brightness-110 disabled:opacity-70"
        >
          {sending && <Spinner width={16} height={16} />}
          {sending ? "Sending…" : "Send message"}
        </button>
        {state.kind === "error" && (
          <p role="alert" className="text-sm text-accent">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
