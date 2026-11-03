import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";
import { site } from "@/lib/site";

export function contactLine() {
  return site.contactEmail ? <>email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a></> : <>use the contact form on our <Link href="/">For businesses</Link> page</>;
}

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="account-page legal-page">
      <header className="account-header">
        <Link className="account-brand" href="/"><span className="account-brand-mark"><MapPin size={19} fill="currentColor" /></span>near to me<span>.</span></Link>
        <Link className="account-back" href="/"><ArrowLeft size={15} /> Back to exploring</Link>
      </header>
      <article className="legal-content">
        <p className="eyebrow">LAST UPDATED {updated.toUpperCase()}</p>
        <h1>{title}</h1>
        {children}
      </article>
    </main>
  );
}
