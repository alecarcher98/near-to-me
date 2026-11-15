"use client";

import { ArrowRight, BadgeCheck, CalendarDays, Check, Compass, Heart, LocateFixed, Map as MapIcon, MapPin, Megaphone, MessageCircle, Navigation, Share2, ShieldCheck, Sparkles, Store, X } from "lucide-react";
import { FormEvent, useState } from "react";
import type { LatLng } from "@/lib/types";

export type MemberProfile = { email: string; name?: string; placeName: string; status: "live" | "waitlist"; areaId?: string; joinedAt: string };
export type JoinedOrigin = LatLng & { label: string; source: "device" | "postcode" };

type JoinResponse =
  | { status: "active"; areaId: string; areaName: string; placeName: string; point: LatLng }
  | { status: "coming-soon"; placeName: string; waiting: number };

// Everything the site does, shown once someone has joined so they know what's there.
export const features: { icon: typeof Compass; title: string; text: string }[] = [
  { icon: Navigation, title: "Closest first", text: "Every shop, café, gym and car park sorted by how far it is from you, with walking times." },
  { icon: Compass, title: "What do you need?", text: "Food, shops, things to do, gyms, high-protein and low-cal eats, pubs, parking and EV charging in one tap." },
  { icon: MapIcon, title: "A real street map", text: "Every place pinned with its own icon. Drag, zoom and tap a pin to see the details." },
  { icon: Sparkles, title: "Just opened", text: "New places get the top spot for their first three weeks, so you hear about them first." },
  { icon: CalendarDays, title: "This week", text: "Quiz nights, live music, deals and one-off events happening around you this week." },
  { icon: Heart, title: "Favourites & visits", text: "Save the places you love and keep track of everywhere you’ve been." },
  { icon: MessageCircle, title: "Local reviews", text: "Read honest reviews from people nearby, and leave your own in seconds." },
  { icon: MapPin, title: "Parking & EV charging", text: "The nearest car parks and EV charge points, with what3words to copy and directions in Apple or Google Maps." },
  { icon: Megaphone, title: "Local noticeboard", text: "News, offers and recommendations from your local guide team." },
  { icon: Store, title: "For local businesses", text: "Get listed, featured when you open, and collect reviews from your neighbours." },
];

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Something went wrong. Please try again.");
  return result as T;
}

// The first screen: area and email before anything else. Live areas go straight in; anywhere else joins the waitlist.
export function WelcomeGate({ liveAreaName, onJoined, onFinish, onBusiness }: { liveAreaName: string; onJoined: (member: MemberProfile, origin: JoinedOrigin | null) => void; onFinish: () => void; onBusiness: () => void }) {
  const [step, setStep] = useState<"join" | "done">("join");
  const [position, setPosition] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<JoinResponse | null>(null);

  function useLocation() {
    if (!("geolocation" in navigator)) {
      setError("Your browser can't share a location. Type your town or postcode instead.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (found) => { setPosition({ lat: found.coords.latitude, lng: found.coords.longitude }); setLocating(false); },
      (failure) => { setLocating(false); setError(failure.code === failure.PERMISSION_DENIED ? "Location access was blocked. Type your town or postcode instead." : "We couldn't find you just now. Type your town or postcode instead."); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const typed = String(form.get("location") ?? "").trim();
    if (!position && !typed) {
      setError("Tell us where you are: use your location, or type your town or postcode.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const email = String(form.get("email") ?? "").trim();
      const name = String(form.get("name") ?? "").trim();
      const answer = await postJson<JoinResponse>("/api/join", { email, name, contactTime: form.get("contactTime"), ...(position && !typed ? position : { location: typed }) });
      const member: MemberProfile = { email: email.toLowerCase(), ...(name ? { name } : {}), placeName: answer.placeName, status: answer.status === "active" ? "live" : "waitlist", ...(answer.status === "active" ? { areaId: answer.areaId } : {}), joinedAt: new Date().toISOString() };
      const origin: JoinedOrigin | null = answer.status !== "active" ? null
        : position && !typed ? { ...position, label: "Your location", source: "device" }
        : { ...answer.point, label: /\d/.test(typed) ? typed.toUpperCase() : answer.placeName.split(",")[0], source: "postcode" };
      onJoined(member, origin);
      setResult(answer);
      setStep("done");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We couldn't sign you up. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function share() {
    const data = { title: "Near to me", text: "Everything good near you, closest first. Ask for it in your area:", url: window.location.origin };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(data.url);
    } catch {
      // Cancelled by the visitor.
    }
  }

  return (
    <div className="welcome-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <section className={step === "join" ? "welcome-card" : "welcome-card welcome-card-wide"}>
        <div className="welcome-brand"><span className="brand-mark"><MapPin size={18} fill="currentColor" /></span>near to me<span className="brand-period">.</span></div>

        {step === "join" && (
          <>
            <p className="eyebrow">WHAT’S GOOD, CLOSEST TO YOU</p>
            <h1 id="welcome-title">Where are you?</h1>
            <p className="welcome-lead">Tell us your area and email and we’ll show you the best shops, food, gyms, parking and things to do, nearest first. Live in {liveAreaName} now, with more towns on the way.</p>
            <form className="welcome-form" onSubmit={submit}>
              <span className="field-label">YOUR AREA</span>
              <div className="welcome-location">
                <button type="button" className={position ? "welcome-locate located" : "welcome-locate"} onClick={useLocation} disabled={locating}>{position ? <><Check size={15} /> Using your location</> : <><LocateFixed size={15} /> {locating ? "Finding you…" : "Use my location"}</>}</button>
                <span className="welcome-or">or</span>
                <input name="location" placeholder="Town or postcode" maxLength={120} autoComplete="postal-code" aria-label="Town or postcode" onChange={(event) => { if (event.target.value) setPosition(null); }} />
              </div>
              <div className="form-two">
                <label className="field-label">EMAIL<input name="email" type="email" required maxLength={160} autoComplete="email" placeholder="you@example.com" /></label>
                <label className="field-label">FIRST NAME <span className="optional">(optional)</span><input name="name" maxLength={80} autoComplete="given-name" /></label>
              </div>
              <input className="form-trap" name="contactTime" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-button welcome-submit" type="submit" disabled={sending}>{sending ? "Checking your area…" : "Show me what’s near me"} <ArrowRight size={16} /></button>
              <p className="welcome-privacy"><ShieldCheck size={12} /> We use your email to tell you about Near to me in your area, nothing else. Your exact location stays on this device. <a href="/privacy">Privacy</a></p>
            </form>
          </>
        )}

        {step === "done" && result && (
          <>
            {result.status === "active" ? (
              <>
                <p className="eyebrow"><BadgeCheck size={13} /> YOU’RE IN</p>
                <h1 id="welcome-title">Welcome to {result.areaName}’s local guide.</h1>
                <p className="welcome-lead">Here’s everything you can do. It’s all sorted from {result.placeName.split(",")[0]}.</p>
              </>
            ) : (
              <>
                <p className="eyebrow"><Sparkles size={13} /> COMING SOON TO {result.placeName.toUpperCase()}</p>
                <h1 id="welcome-title">You’re on the list for {result.placeName.split(",")[0]}.</h1>
                <p className="welcome-lead">{result.waiting > 1 ? `You and ${result.waiting - 1} other${result.waiting === 2 ? "" : "s"} have asked for ${result.placeName.split(",")[0]}. ` : `You’re the first to ask for ${result.placeName.split(",")[0]}. `}The more people who ask, the sooner it launches, and we’ll email you the day it does. In the meantime, here’s everything you’ll get, and you can try it out in {liveAreaName} now.</p>
              </>
            )}
            <div className="welcome-features">
              {features.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon size={17} /></span><div><b>{title}</b><p>{text}</p></div></article>)}
            </div>
            <div className="welcome-actions">
              <button className="primary-button welcome-submit" onClick={onFinish}>{result.status === "active" ? "Start exploring" : `Explore ${liveAreaName} now`} <ArrowRight size={16} /></button>
              {result.status !== "active" && <button className="outline-button" onClick={() => void share()}><Share2 size={14} /> Share to get it here sooner</button>}
              {result.status !== "active" && <button className="outline-button" onClick={onBusiness}><Store size={14} /> Run a business there? Tell us</button>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// The same feature tour, reopened from the sidebar.
export function FeatureTour({ onClose }: { onClose: () => void }) {
  return (
    <div className="welcome-backdrop" role="dialog" aria-modal="true" aria-labelledby="tour-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="welcome-card welcome-card-wide">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>
        <p className="eyebrow">EVERYTHING NEAR TO ME DOES</p>
        <h1 id="tour-title">Good things, right around you.</h1>
        <div className="welcome-features">
          {features.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon size={17} /></span><div><b>{title}</b><p>{text}</p></div></article>)}
        </div>
        <div className="welcome-actions"><button className="primary-button welcome-submit" onClick={onClose}>Back to the guide <ArrowRight size={16} /></button></div>
      </section>
    </div>
  );
}
