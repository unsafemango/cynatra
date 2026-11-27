import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  alternates: { canonical: "/privacy" },
  description: "What Cynatra stores about you, why, who else is involved, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="November 27, 2026"
      intro={
        <p>
          Cynatra helps you pick something to watch. We keep as little about you as we can, we don&apos;t show ads,
          and we never sell or share your data for marketing.
        </p>
      }
      sections={[
        {
          heading: "Without an account",
          body: (
            <p>
              You can spin, search and use the Shortlist without signing up. Your filters, Shortlist, theme, “Seen it”
              marks and similar settings are kept in your own browser (local storage), not on our servers.
            </p>
          ),
        },
        {
          heading: "With an account, we store",
          body: (
            <ul>
              <li>Your email address, and a securely hashed password if you sign up with email.</li>
              <li>
                If you use “Continue with Google”: your Google account ID and email address. We don&apos;t get your
                Google password, contacts or anything else.
              </li>
              <li>Your country (for streaming availability) and the streaming services you tell us you have.</li>
              <li>Your Watchlist, Watching, Seen and spin History.</li>
              <li>
                Any thumbs up or down you give titles you&apos;ve seen. For each rated title we also save who directed
                or created it and its main cast.
              </li>
              <li>If you contact support: your message and the email address to reply to.</li>
            </ul>
          ),
        },
        {
          heading: "Your taste",
          body: (
            <>
              <p>
                From your ratings we work out which genres, decades and people you lean toward or away from. You can see
                this under “Your taste” on your <Link href="/profile">Profile</Link>.
              </p>
              <p>
                While “Match my taste” is on (it is unless you switch it off on the Spin page), your spins use it to
                favour some titles over others and to say why one was picked. It isn&apos;t used for advertising.
              </p>
            </>
          ),
        },
        {
          heading: "How we use it",
          body: (
            <p>
              Only to run Cynatra: signing you in, sending sign-up codes, showing your library, avoiding titles
              you&apos;ve seen, matching spins to your taste, showing what&apos;s streaming in your country, and
              answering your support messages. There are no analytics or tracking scripts, and no advertising cookies. Signing in stores a login token in
              your browser so you stay signed in.
            </p>
          ),
        },
        {
          heading: "Services we rely on",
          body: (
            <ul>
              <li>
                <strong>Oracle Cloud</strong> hosts the site and its database (in Canada).
              </li>
              <li>
                <strong>Cloudflare</strong> runs our domain&apos;s DNS and forwards email sent to support@cynatra.app.
              </li>
              <li>
                <strong>Brevo</strong> sends our emails (sign-up codes and support replies).
              </li>
              <li>
                <strong>Google</strong> handles “Continue with Google” if you choose it.
              </li>
              <li>
                <strong>TMDB</strong> (and JustWatch through TMDB) provides titles, posters and where-to-watch data, and{" "}
                <strong>IMDb</strong> provides ratings. We look titles up on your behalf without telling them who you
                are. To match your taste, a lookup may ask TMDB for movies featuring people from titles you&apos;ve
                liked.
              </li>
              <li>
                Trailers play from <strong>YouTube</strong> (privacy-enhanced mode) only when you press Trailer.
              </li>
            </ul>
          ),
        },
        {
          heading: "Keeping and deleting your data",
          body: (
            <p>
              We keep your account until you ask us to delete it. You can remove a rating by pressing the same thumb
              again, or clear them all with “Reset my taste” on your <Link href="/profile">Profile</Link>; the cast and
              director saved for those titles go too. To delete your account and everything linked to it,{" "}
              <Link href="/help#contact">send us a message</Link> from the email on your account and we&apos;ll remove it
              within 30 days. You can also ask for a copy of what we hold about you. Data in your browser can be cleared
              at any time from your browser&apos;s settings.
            </p>
          ),
        },
        {
          heading: "Security",
          body: (
            <p>
              Everything travels over HTTPS, passwords are stored only as salted hashes, and access to the server and
              database is restricted. No system is perfectly secure, but we take reasonable care to protect your data.
            </p>
          ),
        },
        {
          heading: "Children",
          body: <p>Cynatra isn&apos;t meant for children under 13, and we don&apos;t knowingly collect their data.</p>,
        },
        {
          heading: "Changes",
          body: (
            <p>
              If this policy changes, we&apos;ll update the date at the top. For a significant change, we&apos;ll let
              account holders know by email.
            </p>
          ),
        },
      ]}
    />
  );
}
