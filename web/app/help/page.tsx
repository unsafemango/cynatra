import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Help & support",
  alternates: { canonical: "/help" },
  description: "Answers to common questions about Cynatra, and a way to reach support.",
};

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is Cynatra?",
    a: "A cure for endless scrolling: set a few filters (or pick a mood), hit Spin, and get one movie or series to watch tonight, with its trailer and where to stream it.",
  },
  {
    q: "How does Spin choose a title?",
    a: "It picks at random from titles that match your filters. To keep it to things people actually like, titles need a fair number of votes, and the minimum rating is checked against IMDb. A spin won't repeat what it already showed you this session, and when you're logged in it skips anything you've marked Seen or are Watching.",
  },
  {
    q: "Which rating is shown?",
    a: "IMDb's, by default. You can switch to TMDB's score with “Ratings from” at the bottom of any page, or on your profile. If IMDb has no rating for a title yet, TMDB's is shown instead, labelled TMDB.",
  },
  {
    q: "What do the filters and moods do?",
    a: "Moods are shortcuts that pick genres for you (Cozy, Scary, Mind-bending…). You can also set the type, genres, release years, minimum rating, maximum runtime, original language, and a “bright & colourful” look for something visually cheerful.",
  },
  {
    q: "What's in my Library?",
    a: "Watchlist (saved for later), Watching (what you've started), Seen (never suggested again) and History (everything you've spun). “Spin my watchlist” picks something from your watchlist instead of the whole catalogue.",
  },
  {
    q: "What is the Shortlist?",
    a: "A way to choose between up to 5 titles you already have in mind. Add them from search, spins or title pages, then let Instant pick choose one or knock them out one by one. The shortlist is kept in this browser.",
  },
  {
    q: "Why does “where to watch” look wrong?",
    a: "Streaming availability depends on your country. Logged in, set your country on your profile. The data comes from JustWatch through TMDB and can lag a little behind the services themselves.",
  },
  {
    q: "I didn't get my sign-up code.",
    a: "Codes come from noreply@cynatra.app within a minute. Check Spam and Promotions, and make sure the address is spelled right. Codes expire after 10 minutes; you can ask for a new one after a minute. Or skip codes entirely with “Continue with Google”.",
  },
  {
    q: "How do I delete my account or my data?",
    a: "Send us a message below (from the email on your account) and we'll delete your account, watchlist and history.",
  },
  {
    q: "Is Cynatra free?",
    a: "Yes, completely. There are no ads and nothing to buy.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Help &amp; support</h1>
        <p className="mt-2 text-muted">Quick answers first. Still stuck? Send us a message below.</p>
      </header>

      <section aria-labelledby="faq" className="rounded-3xl border border-border bg-surface p-2 sm:p-3">
        <h2 id="faq" className="sr-only">
          Frequently asked questions
        </h2>
        {FAQ.map((item) => (
          <details key={item.q} className="group rounded-2xl px-4 py-1 open:bg-surface-2/50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
                className="shrink-0 text-muted transition-transform group-open:rotate-180"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="pb-4 text-[15px] leading-relaxed text-foreground/85">{item.a}</p>
          </details>
        ))}
      </section>

      <section
        id="contact"
        aria-labelledby="contact-title"
        className="rounded-3xl border border-border bg-surface p-6 sm:p-8"
      >
        <h2 id="contact-title" className="text-lg font-semibold tracking-tight">
          Contact support
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          We read every message and reply by email, usually within a couple of days. You can also write to{" "}
          <a href="mailto:support@cynatra.app" className="text-foreground hover:underline underline-offset-4">
            support@cynatra.app
          </a>
          .
        </p>
        <ContactForm />
      </section>
    </div>
  );
}
