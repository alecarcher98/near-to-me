import type { Metadata } from "next";
import LegalPage, { contactLine } from "@/components/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms — Near to me", description: "The rules for using Near to me." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="3 November 2026">
      <p>These terms apply when you use {site.name}, run by {site.operator}. By using the site you agree to them. Questions? {contactLine()}.</p>

      <h2>Listings and events</h2>
      <p>We work hard to keep places, opening hours, prices and events accurate, but businesses change things. Always check with a business before you travel. Distances are straight-line estimates, not routes.</p>

      <h2>Sponsored and recommended places</h2>
      <p>Businesses can pay to appear higher in results. Sponsored places are always labelled <b>Sponsored</b>. Places marked <b>Recommended</b> or <b>Just opened</b> are chosen by our team and are not paid placements.</p>

      <h2>Reviews</h2>
      <p>Reviews must be your own honest experience. Don’t post anything abusive, discriminatory, misleading, promotional, or that includes someone else’s personal details. We remove reviews that break these rules, and we may remove others at our discretion. You’re responsible for what you post.</p>

      <h2>Using the site fairly</h2>
      <p>Don’t try to break, overload or scrape the site, or get into the admin area without permission.</p>

      <h2>Changes</h2>
      <p>We may update these terms. The date at the top shows when they last changed.</p>
    </LegalPage>
  );
}
