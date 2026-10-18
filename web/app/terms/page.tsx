import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of service",
  alternates: { canonical: "/terms" },
  description: "The rules for using Cynatra.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="October 17, 2026"
      intro={
        <p>
          By using Cynatra (cynatra.app), you agree to these terms. They&apos;re short, because Cynatra is a free tool
          for picking something to watch.
        </p>
      }
      sections={[
        {
          heading: "Using Cynatra",
          body: (
            <ul>
              <li>Cynatra is free, has no ads, and has nothing to buy.</li>
              <li>You need to be at least 13 to create an account.</li>
              <li>Keep your login details to yourself; you&apos;re responsible for what happens on your account.</li>
              <li>
                Don&apos;t misuse the service: no attempts to break or overload it, scrape it in bulk, get into other
                people&apos;s accounts, or use it for anything illegal.
              </li>
            </ul>
          ),
        },
        {
          heading: "Titles, ratings and where to watch",
          body: (
            <p>
              Title information and posters come from TMDB, streaming availability from JustWatch through TMDB, and
              ratings from IMDb. They can be incomplete or out of date, and a title may have left a service by the time
              you look. Cynatra isn&apos;t endorsed by or affiliated with TMDB, JustWatch, IMDb or any streaming service,
              and their names and logos belong to their owners. Trailers are hosted by YouTube.
            </p>
          ),
        },
        {
          heading: "Your account and data",
          body: (
            <p>
              Your library is yours. See the <Link href="/privacy">privacy policy</Link> for what we store and how to
              delete it. We may suspend accounts that break these terms.
            </p>
          ),
        },
        {
          heading: "No guarantees",
          body: (
            <p>
              Cynatra is provided “as is”. We do our best to keep it running and accurate, but we can&apos;t promise it
              will always be available or error-free, and we may change or stop features at any time. To the extent the
              law allows, we aren&apos;t liable for losses arising from using it.
            </p>
          ),
        },
        {
          heading: "Changes and governing law",
          body: (
            <p>
              We may update these terms; the date at the top shows the latest version, and continuing to use Cynatra
              means you accept it. These terms are governed by the laws of Ontario, Canada.
            </p>
          ),
        },
      ]}
    />
  );
}
