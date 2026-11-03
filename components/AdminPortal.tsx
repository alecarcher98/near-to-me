"use client";

import { ArrowLeft, CalendarDays, Copy, Download, Globe, Inbox, LogOut, Mail, MapPin, Megaphone, MessageCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { areas, defaultAreaId } from "@/lib/areas";
import { weekdays } from "@/lib/events";
import { placeLabel } from "@/lib/geocode";
import { isSponsored, isSpotlight, placeCategories } from "@/lib/places";
import type { AreaContent, Enquiry, LocalEvent, Place, Update, WaitlistEntry } from "@/lib/types";

type Section = "enquiries" | "waitlist" | "places" | "events" | "updates" | "reviews";
type Draft<T> = Partial<T> & { isNew?: boolean };

const area = areas[defaultAreaId];
const sections: { id: Section; label: string; icon: typeof Inbox }[] = [
  { id: "enquiries", label: "Business enquiries", icon: Inbox },
  { id: "waitlist", label: "Coming soon", icon: Globe },
  { id: "places", label: "Places", icon: MapPin },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "updates", label: "Noticeboard", icon: Megaphone },
  { id: "reviews", label: "Reviews", icon: MessageCircle },
];
const enquiryLabels: Record<Enquiry["kind"], string> = { sponsorship: "Sponsorship", listing: "New listing", reviews: "Reviews", other: "Other" };
const sourceLabels: Record<WaitlistEntry["source"], string> = { signup: "Signed up", "business-signup": "Business sign-up", enquiry: "Business enquiry", explore: "Explore page" };

function waitlistLocation(entry: WaitlistEntry) {
  return entry.place ? placeLabel(entry.place) : entry.location;
}

function comingSoonEmail(place: string) {
  return {
    subject: `Near to me is coming to ${place}`,
    body: `Hi,\n\nThanks for signing up to Near to me. We're not live in ${place} just yet, but it's coming soon, and you'll be one of the first to know when it's available there.\n\nWe'll email you again as soon as your local guide launches.\n\nThe Near to me team`,
  };
}

function downloadCsv(entries: WaitlistEntry[]) {
  const cell = (value: string | undefined) => `"${(value ?? "").replace(/"/g, '""')}"`;
  const rows = [["Location", "Name", "Email", "Typed location", "Source", "Signed up", "Emailed"], ...entries.map((entry) => [waitlistLocation(entry), entry.name, entry.email, entry.location, sourceLabels[entry.source], entry.createdAt.slice(0, 10), entry.notifiedAt?.slice(0, 10)])];
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([rows.map((row) => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  link.download = `near-to-me-coming-soon-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function dateInput(value?: string) {
  return value ? value.slice(0, 10) : "";
}

function inThreeWeeks(from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + 21);
  return date.toISOString().slice(0, 10);
}

async function api(method: string, url: string, body?: unknown) {
  const response = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status}).`);
  return result;
}

export default function AdminPortal() {
  const [session, setSession] = useState<{ enabled: boolean; admin: string | null } | null>(null);
  const [content, setContent] = useState<AreaContent | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [section, setSection] = useState<Section>("enquiries");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [placeDraft, setPlaceDraft] = useState<Draft<Place> | null>(null);
  const [eventDraft, setEventDraft] = useState<Draft<LocalEvent> | null>(null);
  const [updateDraft, setUpdateDraft] = useState<Draft<Update> | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const [areaContent, waitlistResult] = await Promise.all([api("GET", `/api/admin/content?area=${area.id}`), api("GET", "/api/admin/waitlist")]);
      setContent(areaContent as AreaContent);
      setWaitlist((waitlistResult as { entries: WaitlistEntry[] }).entries);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not load content.", error: true });
    }
  }, []);

  useEffect(() => {
    api("GET", "/api/admin/session").then((result) => setSession(result as { enabled: boolean; admin: string | null })).catch(() => setSession({ enabled: false, admin: null }));
  }, []);

  useEffect(() => {
    if (session?.admin) void load();
  }, [session?.admin, load]);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      await load();
      setMessage({ text: success });
      return true;
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "That didn't work.", error: true });
      return false;
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api("POST", "/api/admin/session", { name: form.get("name"), password: form.get("password") }) as { admin: string };
      setSession({ enabled: true, admin: result.admin });
      setMessage(null);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Sign-in failed.", error: true });
    }
  }

  async function signOut() {
    await api("DELETE", "/api/admin/session").catch(() => undefined);
    setSession((current) => current && { ...current, admin: null });
    setContent(null);
  }

  const save = (collection: "places" | "events" | "updates", item: Record<string, unknown>, done: () => void) =>
    run(() => api("PUT", `/api/admin/content?area=${area.id}`, { collection, item }), "Saved — it's live on the site now.").then((ok) => { if (ok) done(); });

  const remove = (collection: keyof AreaContent, id: string, label: string) => {
    if (!window.confirm(`Remove “${label}”? This can't be undone.`)) return;
    void run(() => api("DELETE", `/api/admin/content?area=${area.id}&collection=${collection}&id=${encodeURIComponent(id)}`), "Removed.");
  };

  function listingFromEnquiry(enquiry: Enquiry) {
    const opened = enquiry.openingDate ? new Date(`${enquiry.openingDate}T00:00:00`) : null;
    const isNew = Boolean(opened && opened.getTime() + 21 * 86_400_000 > Date.now());
    setPlaceDraft({
      isNew: true,
      name: enquiry.businessName,
      address: enquiry.address ?? "",
      details: [enquiry.message.split("\n\nContact role:")[0], enquiry.phone && `Tel ${enquiry.phone}`, enquiry.website].filter(Boolean).join(" · "),
      launchSpotlight: isNew,
      spotlightEndsAt: isNew && opened ? inThreeWeeks(opened) : undefined,
      spotlightNote: isNew ? "New local opening — featured for its first three weeks." : undefined,
    });
    setSection("places");
  }

  const filteredPlaces = useMemo(() => {
    const search = placeQuery.trim().toLowerCase();
    return (content?.places ?? []).filter((place) => !search || `${place.name} ${place.category} ${place.address}`.toLowerCase().includes(search));
  }, [content?.places, placeQuery]);

  if (!session) return <main className="admin-shell"><p className="admin-loading">Loading admin portal…</p></main>;

  if (!session.admin) {
    return (
      <main className="admin-shell admin-login-shell">
        <form className="admin-login" onSubmit={signIn}>
          <Link className="admin-back" href="/"><ArrowLeft size={14} /> Back to the guide</Link>
          <p className="eyebrow">NEAR TO ME · ADMIN</p>
          <h1>Guide team sign-in</h1>
          {!session.enabled && <p className="admin-message error">Admin sign-in isn't set up on this server yet. Set <code>ADMIN_USERS</code> and <code>ADMIN_SESSION_SECRET</code> (see README).</p>}
          <label className="field-label">NAME<input name="name" autoComplete="username" required /></label>
          <label className="field-label">PASSWORD<input name="password" type="password" autoComplete="current-password" required /></label>
          {message && <p className={message.error ? "admin-message error" : "admin-message"} role="status">{message.text}</p>}
          <button className="primary-button" type="submit" disabled={!session.enabled}>Sign in</button>
        </form>
      </main>
    );
  }

  const newEnquiries = content?.enquiries.filter((enquiry) => enquiry.status === "new").length ?? 0;
  const waitingToHear = waitlist.filter((entry) => !entry.notifiedAt).length;
  const waitlistGroups = Object.entries(waitlist.reduce<Record<string, WaitlistEntry[]>>((groups, entry) => {
    (groups[waitlistLocation(entry)] ??= []).push(entry);
    return groups;
  }, {})).sort((a, b) => b[1].length - a[1].length);

  function copyText(text: string, success: string) {
    void navigator.clipboard.writeText(text).then(() => setMessage({ text: success })).catch(() => setMessage({ text: "Copy failed — select and copy it manually.", error: true }));
  }

  const markEmailed = (ids: string[], notified = true) => run(() => api("PATCH", "/api/admin/waitlist", { ids, notified }), notified ? "Marked as emailed." : "Marked as not emailed yet.");

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p className="eyebrow">NEAR TO ME · {area.name.toUpperCase()} GUIDE ADMIN</p><h1>Keep the guide fresh.</h1><p>Everything you change here is live on the site straight away.</p></div>
        <div className="admin-header-actions"><span>Signed in as <b>{session.admin}</b></span><Link className="outline-button" href="/">View site</Link><button className="outline-button" onClick={signOut}><LogOut size={14} /> Sign out</button></div>
      </header>
      <nav className="admin-tabs">
        {sections.map(({ id, label, icon: Icon }) => (
          <button key={id} className={section === id ? "admin-tab active" : "admin-tab"} onClick={() => setSection(id)}><Icon size={15} /> {label}{id === "enquiries" && newEnquiries > 0 && <span className="nav-count">{newEnquiries}</span>}{id === "waitlist" && waitingToHear > 0 && <span className="nav-count">{waitingToHear}</span>}</button>
        ))}
      </nav>
      {message && <p className={message.error ? "admin-message error" : "admin-message"} role="status">{message.text}</p>}
      {!content ? <p className="admin-loading">Loading content…</p> : (
        <>
          {section === "enquiries" && (
            <section className="admin-panel">
              <h2>Business enquiries <small>{content.enquiries.length}</small></h2>
              <p className="admin-hint">Sponsorship requests, new listings and review questions from businesses. Reply by email, then move them along.</p>
              {content.enquiries.length === 0 && <p className="admin-empty">No enquiries yet.</p>}
              {content.enquiries.map((enquiry) => (
                <article className={`admin-row admin-enquiry status-${enquiry.status}`} key={enquiry.id}>
                  <div className="admin-row-main">
                    <span className="admin-pill">{enquiryLabels[enquiry.kind]}</span>
                    <b>{enquiry.businessName}</b>
                    {enquiry.comingSoonFor && <span className="admin-pill admin-pill-soon">Outside live areas · {enquiry.comingSoonFor}</span>}
                    <small>{enquiry.contactName} · <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a>{enquiry.phone && ` · ${enquiry.phone}`} · {new Date(enquiry.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small>
                    {(enquiry.businessType || enquiry.address || enquiry.openingDate || enquiry.website) && <small>{[enquiry.businessType, enquiry.address, enquiry.openingDate && `Opening ${enquiry.openingDate}`, enquiry.website].filter(Boolean).join(" · ")}</small>}
                    <p>{enquiry.message}</p>
                  </div>
                  <div className="admin-row-actions">
                    <select value={enquiry.status} onChange={(event) => void run(() => api("PATCH", `/api/admin/content?area=${area.id}`, { id: enquiry.id, status: event.target.value }), "Status updated.")} aria-label="Enquiry status"><option value="new">New</option><option value="in-progress">In progress</option><option value="done">Done</option></select>
                    {enquiry.kind === "listing" && <button className="outline-button" onClick={() => listingFromEnquiry(enquiry)}><Plus size={14} /> Create listing</button>}
                    <button className="icon-outline" onClick={() => remove("enquiries", enquiry.id, enquiry.businessName)} aria-label="Delete enquiry"><Trash2 size={15} /></button>
                  </div>
                </article>
              ))}
            </section>
          )}

          {section === "waitlist" && (
            <section className="admin-panel">
              <div className="admin-panel-heading"><h2>Coming soon <small>{waitlist.length} people · {waitlistGroups.length} locations</small></h2>{waitlist.length > 0 && <button className="outline-button" onClick={() => downloadCsv(waitlist)}><Download size={14} /> Download CSV</button>}</div>
              <p className="admin-hint">People who signed up, enquired or searched from somewhere {area.name} doesn’t cover yet. They’ve been told it’s coming soon. Email them, then mark them as emailed. Locations with the most people are listed first.</p>
              {waitlist.length === 0 && <p className="admin-empty">Nobody outside {area.name} has signed up yet.</p>}
              {waitlistGroups.map(([location, entries]) => {
                const pending = entries.filter((entry) => !entry.notifiedAt);
                const email = comingSoonEmail(location.split(",")[0]);
                return (
                  <article className="admin-waitlist-group" key={location}>
                    <div className="admin-waitlist-heading">
                      <div><b><MapPin size={14} /> {location}</b><small>{entries.length} {entries.length === 1 ? "person" : "people"} · {pending.length} not emailed yet</small></div>
                      {pending.length > 0 && (
                        <div className="admin-row-actions">
                          <button className="outline-button" onClick={() => copyText(pending.map((entry) => entry.email).join(", "), `Copied ${pending.length} email address${pending.length === 1 ? "" : "es"}.`)}><Copy size={14} /> Copy emails</button>
                          <a className="outline-button" href={`mailto:?bcc=${encodeURIComponent(pending.map((entry) => entry.email).join(","))}&subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}><Mail size={14} /> Email them</a>
                          <button className="outline-button" onClick={() => copyText(`${email.subject}\n\n${email.body}`, "Email message copied.")}><Copy size={14} /> Copy message</button>
                          <button className="primary-button" onClick={() => void markEmailed(pending.map((entry) => entry.id))}>Mark all emailed</button>
                        </div>
                      )}
                    </div>
                    {entries.map((entry) => (
                      <div className={entry.notifiedAt ? "admin-waitlist-row emailed" : "admin-waitlist-row"} key={entry.id}>
                        <span><b>{entry.name || "—"}</b> <a href={`mailto:${entry.email}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}>{entry.email}</a></span>
                        <small>{sourceLabels[entry.source]}{entry.role === "business" ? " · business" : ""} · typed “{entry.location}” · {new Date(entry.createdAt).toLocaleDateString("en-GB")}{entry.notifiedAt && ` · emailed ${new Date(entry.notifiedAt).toLocaleDateString("en-GB")}`}</small>
                        <span className="admin-row-actions">
                          <button className="outline-button" onClick={() => void markEmailed([entry.id], !entry.notifiedAt)}>{entry.notifiedAt ? "Undo emailed" : "Mark emailed"}</button>
                          <button className="icon-outline" onClick={() => { if (window.confirm(`Remove ${entry.email} from the coming-soon list?`)) void run(() => api("DELETE", `/api/admin/waitlist?id=${encodeURIComponent(entry.id)}`), "Removed."); }} aria-label={`Remove ${entry.email}`}><Trash2 size={15} /></button>
                        </span>
                      </div>
                    ))}
                  </article>
                );
              })}
            </section>
          )}

          {section === "places" && (
            <section className="admin-panel">
              <div className="admin-panel-heading"><h2>Places <small>{content.places.length}</small></h2><button className="primary-button" onClick={() => setPlaceDraft({ isNew: true, category: "Food" })}><Plus size={15} /> Add a place</button></div>
              <p className="admin-hint">Tick “Just opened” to pin a new place to the top for three weeks, “Sponsored” for paid placement (always labelled), or “High protein / low cal” to show it under Healthy eats.</p>
              {placeDraft && <PlaceForm key={placeDraft.id ?? `new-${placeDraft.name ?? ""}`} draft={placeDraft} onCancel={() => setPlaceDraft(null)} onSave={(item) => save("places", item, () => setPlaceDraft(null))} />}
              <label className="admin-search"><Search size={15} /><input value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="Search places" /></label>
              {filteredPlaces.map((place) => (
                <article className="admin-row" key={place.id}>
                  <div className="admin-row-main"><b>{place.name}</b><small>{place.category} · {place.address}</small><span className="admin-flags">{isSpotlight(place) && <span className="admin-pill">Just opened</span>}{isSponsored(place) && <span className="admin-pill">Sponsored</span>}{place.recommended && <span className="admin-pill">Recommended</span>}{place.tags?.includes("healthy") && <span className="admin-pill">Healthy</span>}</span></div>
                  <div className="admin-row-actions"><button className="outline-button" onClick={() => { setPlaceDraft(place); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil size={14} /> Edit</button><button className="icon-outline" onClick={() => remove("places", place.id, place.name)} aria-label={`Delete ${place.name}`}><Trash2 size={15} /></button></div>
                </article>
              ))}
            </section>
          )}

          {section === "events" && (
            <section className="admin-panel">
              <div className="admin-panel-heading"><h2>Events <small>{content.events.length}</small></h2><button className="primary-button" onClick={() => setEventDraft({ isNew: true, day: "Friday" })}><Plus size={15} /> Add an event</button></div>
              <p className="admin-hint">Leave the date empty for a weekly event. Add a date for a one-off — it only shows in the week it happens.</p>
              {eventDraft && <EventForm key={eventDraft.id ?? "new"} draft={eventDraft} onCancel={() => setEventDraft(null)} onSave={(item) => save("events", item, () => setEventDraft(null))} />}
              {content.events.map((event) => (
                <article className="admin-row" key={event.id}>
                  <div className="admin-row-main"><b>{event.title}</b><small>{event.date ? `One-off · ${event.date}` : `Every ${event.day}`} · {event.time} · {event.venue}</small></div>
                  <div className="admin-row-actions"><button className="outline-button" onClick={() => { setEventDraft(event); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil size={14} /> Edit</button><button className="icon-outline" onClick={() => remove("events", event.id, event.title)} aria-label={`Delete ${event.title}`}><Trash2 size={15} /></button></div>
                </article>
              ))}
            </section>
          )}

          {section === "updates" && (
            <section className="admin-panel">
              <div className="admin-panel-heading"><h2>Noticeboard <small>{content.updates.length}</small></h2><button className="primary-button" onClick={() => setUpdateDraft({ isNew: true, kind: "update" })}><Plus size={15} /> Post an update</button></div>
              <p className="admin-hint">Updates, offers and recommendations appear at the bottom of the Explore page. Set an end date to remove them automatically.</p>
              {updateDraft && <UpdateForm key={updateDraft.id ?? "new"} draft={updateDraft} places={content.places} onCancel={() => setUpdateDraft(null)} onSave={(item) => save("updates", item, () => setUpdateDraft(null))} />}
              {content.updates.length === 0 && <p className="admin-empty">Nothing on the noticeboard yet.</p>}
              {content.updates.map((update) => (
                <article className="admin-row" key={update.id}>
                  <div className="admin-row-main"><span className="admin-pill">{update.kind}</span><b>{update.pinned && "📌 "}{update.title}</b><small>Posted {new Date(update.postedAt).toLocaleDateString("en-GB")}{update.expiresAt && ` · ends ${new Date(update.expiresAt).toLocaleDateString("en-GB")}`}</small></div>
                  <div className="admin-row-actions"><button className="outline-button" onClick={() => { setUpdateDraft(update); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil size={14} /> Edit</button><button className="icon-outline" onClick={() => remove("updates", update.id, update.title)} aria-label={`Delete ${update.title}`}><Trash2 size={15} /></button></div>
                </article>
              ))}
            </section>
          )}

          {section === "reviews" && (
            <section className="admin-panel">
              <h2>Reviews <small>{content.reviews.length}</small></h2>
              <p className="admin-hint">Reviews go live as soon as they're posted. Remove anything abusive, off-topic or fake.</p>
              {content.reviews.length === 0 && <p className="admin-empty">No reviews yet.</p>}
              {content.reviews.map((review) => (
                <article className="admin-row" key={review.id}>
                  <div className="admin-row-main"><b>{review.placeName} · {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</b><small>{review.author} · {new Date(review.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</small><p>{review.text}</p></div>
                  <div className="admin-row-actions"><button className="icon-outline" onClick={() => remove("reviews", review.id, `review by ${review.author}`)} aria-label="Delete review"><Trash2 size={15} /></button></div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}

function formObject(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form)) as Record<string, string>;
}

function FormShell({ title, onSubmit, onCancel, children }: { title: string; onSubmit: (form: HTMLFormElement) => void; onCancel: () => void; children: React.ReactNode }) {
  return (
    <form className="admin-form" onSubmit={(event) => { event.preventDefault(); onSubmit(event.currentTarget); }}>
      <h3>{title}</h3>
      {children}
      <div className="admin-form-actions"><button className="primary-button" type="submit">Save & publish</button><button className="outline-button" type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function PlaceForm({ draft, onSave, onCancel }: { draft: Draft<Place>; onSave: (item: Record<string, unknown>) => void; onCancel: () => void }) {
  const [lat, setLat] = useState(draft.lat?.toString() ?? "");
  const [lng, setLng] = useState(draft.lng?.toString() ?? "");
  const [lookup, setLookup] = useState("");

  async function findFromAddress(address: string) {
    const postcode = address.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i)?.[0];
    if (!postcode) {
      setLookup("Add a full postcode to the address first.");
      return;
    }
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
      const result = await response.json() as { result?: { latitude: number | null; longitude: number | null } };
      if (!response.ok || result.result?.latitude == null || result.result.longitude == null) throw new Error();
      setLat(String(result.result.latitude));
      setLng(String(result.result.longitude));
      setLookup(`Location set from ${postcode.toUpperCase()}.`);
    } catch {
      setLookup(`Couldn't find ${postcode.toUpperCase()}. Enter the latitude and longitude by hand.`);
    }
  }

  return (
    <FormShell title={draft.isNew ? "Add a place" : `Edit ${draft.name}`} onCancel={onCancel} onSubmit={(form) => {
      const values = formObject(form);
      onSave({ ...values, id: draft.isNew ? undefined : draft.id, tags: values.healthy ? ["healthy"] : [], launchSpotlight: Boolean(values.launchSpotlight), sponsored: Boolean(values.sponsored), recommended: Boolean(values.recommended), approximateLocation: draft.approximateLocation });
    }}>
      <div className="form-two"><label className="field-label">NAME<input name="name" required defaultValue={draft.name} /></label><label className="field-label">CATEGORY<select name="category" defaultValue={draft.category}>{placeCategories.map((category) => <option key={category}>{category}</option>)}</select></label></div>
      <label className="field-label">ADDRESS (WITH POSTCODE)<input name="address" required defaultValue={draft.address} /></label>
      <div className="form-three">
        <label className="field-label">LATITUDE<input name="lat" required inputMode="decimal" value={lat} onChange={(event) => setLat(event.target.value)} /></label>
        <label className="field-label">LONGITUDE<input name="lng" required inputMode="decimal" value={lng} onChange={(event) => setLng(event.target.value)} /></label>
        <button className="outline-button" type="button" onClick={(event) => void findFromAddress(String(new FormData(event.currentTarget.form!).get("address") ?? ""))}><MapPin size={14} /> Find from postcode</button>
      </div>
      {lookup && <p className="admin-hint">{lookup}</p>}
      <label className="field-label">DETAILS<textarea name="details" rows={3} defaultValue={draft.details} placeholder="Opening hours, prices, what’s good" /></label>
      <div className="admin-checks">
        <label><input type="checkbox" name="healthy" defaultChecked={draft.tags?.includes("healthy")} /> High protein / low cal options</label>
        <label><input type="checkbox" name="recommended" defaultChecked={draft.recommended} /> Recommended by the guide team</label>
      </div>
      <div className="form-three">
        <label className="admin-check-inline"><input type="checkbox" name="launchSpotlight" defaultChecked={draft.launchSpotlight} /> Just opened</label>
        <label className="field-label">FEATURE UNTIL<input type="date" name="spotlightEndsAt" defaultValue={dateInput(draft.spotlightEndsAt) || inThreeWeeks()} /></label>
        <label className="field-label">NOTE<input name="spotlightNote" defaultValue={draft.spotlightNote ?? "New local opening — featured for its first three weeks."} /></label>
      </div>
      <div className="form-three">
        <label className="admin-check-inline"><input type="checkbox" name="sponsored" defaultChecked={draft.sponsored} /> Sponsored</label>
        <label className="field-label">SPONSORED UNTIL <span className="optional">(optional)</span><input type="date" name="sponsoredUntil" defaultValue={dateInput(draft.sponsoredUntil)} /></label>
      </div>
    </FormShell>
  );
}

function EventForm({ draft, onSave, onCancel }: { draft: Draft<LocalEvent>; onSave: (item: Record<string, unknown>) => void; onCancel: () => void }) {
  return (
    <FormShell title={draft.isNew ? "Add an event" : `Edit ${draft.title}`} onCancel={onCancel} onSubmit={(form) => onSave({ ...formObject(form), id: draft.isNew ? undefined : draft.id, posted: draft.posted })}>
      <div className="form-two"><label className="field-label">TITLE<input name="title" required defaultValue={draft.title} /></label><label className="field-label">CATEGORY<input name="category" defaultValue={draft.category ?? "Night out"} list="event-categories" /><datalist id="event-categories"><option>Night out</option><option>Live music</option><option>Good company</option><option>Family</option><option>Fitness</option></datalist></label></div>
      <div className="form-two"><label className="field-label">VENUE<input name="venue" required defaultValue={draft.venue} /></label><label className="field-label">ADDRESS<input name="address" required defaultValue={draft.address} /></label></div>
      <div className="form-three">
        <label className="field-label">EVERY<select name="day" defaultValue={draft.day}>{weekdays.map((day) => <option key={day}>{day}</option>)}</select></label>
        <label className="field-label">OR ONE-OFF DATE<input type="date" name="date" defaultValue={draft.date} /></label>
        <label className="field-label">TIME<input name="time" required defaultValue={draft.time} placeholder="7pm" /></label>
      </div>
      <label className="field-label">SHORT DESCRIPTION<input name="description" required maxLength={200} defaultValue={draft.description} /></label>
      <label className="field-label">FULL DETAILS<textarea name="detail" rows={3} defaultValue={draft.detail} /></label>
      <label className="field-label">POSTED BY<input name="host" defaultValue={draft.host} /></label>
    </FormShell>
  );
}

function UpdateForm({ draft, places, onSave, onCancel }: { draft: Draft<Update>; places: Place[]; onSave: (item: Record<string, unknown>) => void; onCancel: () => void }) {
  return (
    <FormShell title={draft.isNew ? "Post an update" : `Edit ${draft.title}`} onCancel={onCancel} onSubmit={(form) => {
      const values = formObject(form);
      onSave({ ...values, id: draft.isNew ? undefined : draft.id, pinned: Boolean(values.pinned), postedAt: draft.postedAt });
    }}>
      <div className="form-two"><label className="field-label">TYPE<select name="kind" defaultValue={draft.kind}><option value="update">Local update</option><option value="recommendation">Recommendation</option><option value="offer">Offer</option></select></label><label className="field-label">TITLE<input name="title" required defaultValue={draft.title} /></label></div>
      <label className="field-label">MESSAGE<textarea name="body" required rows={3} defaultValue={draft.body} /></label>
      <div className="form-two"><label className="field-label">LINK TO A PLACE <span className="optional">(optional)</span><select name="placeId" defaultValue={draft.placeId ?? ""}><option value="">None</option>{[...places].sort((a, b) => a.name.localeCompare(b.name)).map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label className="field-label">WEB LINK <span className="optional">(optional)</span><input name="link" defaultValue={draft.link} placeholder="https://" /></label></div>
      <div className="form-two"><label className="field-label">SHOW UNTIL <span className="optional">(optional)</span><input type="date" name="expiresAt" defaultValue={dateInput(draft.expiresAt)} /></label><label className="admin-check-inline"><input type="checkbox" name="pinned" defaultChecked={draft.pinned} /> Pin to the top</label></div>
    </FormShell>
  );
}
