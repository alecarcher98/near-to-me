import type { Metadata } from "next";
import LegalPage, { contactLine } from "@/components/LegalPage";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy — Near to me", description: "What Near to me collects, why, and your choices." };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="3 November 2026">
      <p>{site.name} is run by {site.operator}. This page explains what we collect when you use the site, why, and what you can ask us to do with it. To ask a question or exercise any of your rights, {contactLine()}.</p>

      <h2>Your location</h2>
      <p>If you tap <b>Use my location</b>, your browser shares your position with this page so we can sort places by distance. It is kept in your browser. To check whether we cover your area, we send it to our server, which looks up the nearest postcode with <a href="https://postcodes.io/about" target="_blank" rel="noreferrer">postcodes.io</a>, a free public postcode service, and doesn’t keep your position. Postcodes you type are looked up the same way. If you join a coming-soon list from there, we store only the nearest postcode area, never your exact position.</p>

      <h2>Things kept only in your browser</h2>
      <p>Your favourites, places you’ve marked as visited, your chosen location and distance, and the preview account on the Join page are saved in your browser’s local storage. We can’t see them. Clearing your browser data removes them.</p>

      <h2>Things you send us</h2>
      <ul>
        <li><b>Coming-soon sign-ups.</b> If you’re outside an area we cover, we keep your email, optional name and the town or postcode you gave, so we can tell you when we launch there.</li>
        <li><b>Business enquiries and business sign-ups.</b> We keep the contact and business details you send so our team can reply and, if you ask, list your business.</li>
        <li><b>Reviews.</b> Your review, rating and the name you give (or “Local explorer”) are published on the site.</li>
      </ul>
      <p>We use these details only for the reasons above. We don’t sell them or use them for advertising. Our team can delete any of them at your request.</p>

      <h2>Cookies</h2>
      <p>The public site doesn’t set cookies. Our admin team’s sign-in uses one strictly necessary cookie.</p>

      <h2>Who processes data for us</h2>
      <p>The site is hosted by our web host, and saved content is kept in our database provider’s systems. postcodes.io receives postcodes and positions for lookups. Fonts are served from our own site.</p>

      <h2>Your rights</h2>
      <p>Under UK data protection law you can ask to see, correct or delete the personal data we hold about you, or object to how we use it. You can also complain to the <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noreferrer">Information Commissioner’s Office</a>.</p>
    </LegalPage>
  );
}
