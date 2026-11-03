"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Car,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Dumbbell,
  ExternalLink,
  Filter,
  Heart,
  LocateFixed,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  Minus,
  Navigation,
  Plus,
  Salad,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  ThumbsUp,
  Ticket,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { areas, defaultAreaId } from "@/lib/areas";
import { eventsThisWeek } from "@/lib/events";
import { formatDistance, formatTravel, isUkPostcode, projectToMap } from "@/lib/geo";
import { categories, categoryColor, isSponsored, isSpotlight, matchesCategory, nearestByCategory, rankNearby, withDistance, type NearbyPlace } from "@/lib/places";
import type { LatLng, LocalEvent, Place, PublicContent, Update } from "@/lib/types";

type Tab = "explore" | "favourites" | "reviews" | "business";
type Origin = LatLng & { label: string; source: "device" | "postcode" | "centre" };

const area = areas[defaultAreaId];
const townCentre: Origin = { ...area.centre, label: `${area.name} town centre`, source: "centre" };
const allNearby = "Everything nearby";
const radiusOptions = [0.5, 1, 3, 5, 10, 25];
const originKey = "near-to-me:origin";

const needs: { label: string; category: string; icon: typeof Compass; hint: string }[] = [
  { label: "Shops", category: "Shopping", icon: ShoppingBag, hint: "Supermarkets, chemists & independents" },
  { label: "Things to do", category: "Attractions & days out", icon: Ticket, hint: "Parks, theatre, days out" },
  { label: "Gyms & fitness", category: "Gyms & fitness", icon: Dumbbell, hint: "Gyms, leisure centres, courts" },
  { label: "High protein, low cal", category: "Healthy eats", icon: Salad, hint: "Grilled, lean & build-your-own" },
  { label: "Pubs & bars", category: "Pubs & bars", icon: Sparkles, hint: "A drink, a bite, a night out" },
  { label: "Parking", category: "Parking", icon: Car, hint: "Car parks & prices" },
];
const navItems: { id: Tab; label: string; icon: typeof Compass }[] = [
  { id: "explore", label: "Explore nearby", icon: Compass },
  { id: "favourites", label: "Your favourites", icon: Heart },
  { id: "reviews", label: "Local reviews", icon: MessageCircle },
];
const tabTitles: Record<Tab, string> = { explore: "Explore", favourites: "Your favourites", reviews: "Local reviews", business: "For businesses" };
const updateLabels: Record<Update["kind"], string> = { update: "Local update", recommendation: "We recommend", offer: "Offer" };

function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not save ${key} in this browser.`, error);
  }
}

function tidy(text: string, maximum = 118) {
  const result = text.replace(/what3words\s+\/\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
  return result.length > maximum ? `${result.slice(0, maximum).trim()}…` : result;
}

function placeGlyph(category: string) {
  return ({ Food: "✳", Shopping: "◇", Parking: "P", "Attractions & days out": "✦", "Pubs & bars": "◒", "Gyms & fitness": "▲" } as Record<string, string>)[category] ?? "⌖";
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Something went wrong. Please try again.");
  return result;
}

function BrandMark() {
  return <span className="brand-mark"><MapPin size={20} fill="currentColor" /></span>;
}

function ReviewStars({ rating, onRate }: { rating: number; onRate?: (rating: number) => void }) {
  return (
    <span className="review-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => onRate ? (
        <button type="button" className={star <= rating ? "star-button filled" : "star-button"} onClick={() => onRate(star)} key={star} aria-label={`${star} stars`}><Star size={20} fill={star <= rating ? "currentColor" : "none"} /></button>
      ) : <Star size={14} key={star} fill={star <= rating ? "currentColor" : "none"} />)}
    </span>
  );
}

export default function NearToMeApp() {
  const [tab, setTab] = useState<Tab>("explore");
  const [content, setContent] = useState<PublicContent>({ places: area.seedPlaces, events: area.seedEvents, updates: [], reviews: [] });
  const [origin, setOrigin] = useState<Origin>(townCentre);
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState("");
  const [postcode, setPostcode] = useState("");
  const [radius, setRadius] = useState(3);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(allNearby);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [reviewPlace, setReviewPlace] = useState<Place | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [listLimit, setListLimit] = useState(12);
  const [accountName, setAccountName] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [comingSoon, setComingSoon] = useState<{ placeName: string; joined: boolean } | null>(null);

  useEffect(() => {
    setOrigin(readLocal(originKey, townCentre));
    setRadius(readLocal("near-to-me:radius", 3));
    setFavourites(readLocal("near-to-me:favourites", readLocal<string[]>("nearfolk:saved", [])));
    setVisited(readLocal("near-to-me:visited", readLocal<string[]>("nearfolk:visited", [])));
    setAccountName(readLocal<{ name?: string }>("near-to-me:profile", {}).name ?? "");
    setIsLoaded(true);
    fetch(`/api/content?area=${area.id}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<PublicContent> : Promise.reject(new Error(`HTTP ${response.status}`)))
      .then(setContent)
      .catch((error: unknown) => console.error("Could not load the latest local guide; showing the built-in listings.", error));
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    writeLocal(originKey, origin);
    writeLocal("near-to-me:radius", radius);
    writeLocal("near-to-me:favourites", favourites);
    writeLocal("near-to-me:visited", visited);
  }, [origin, radius, favourites, visited, isLoaded]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => setListLimit(12), [selectedCategory, query, radius, origin]);

  // Outside every live area? Offer a coming-soon sign-up for that location.
  useEffect(() => {
    setComingSoon(null);
    if (origin.source === "centre") return;
    const params = origin.source === "postcode" ? `location=${encodeURIComponent(origin.label)}` : `lat=${origin.lat}&lng=${origin.lng}`;
    let cancelled = false;
    fetch(`/api/coverage?${params}`)
      .then((response) => response.ok ? response.json() as Promise<{ status: string; placeName: string }> : null)
      .then((result) => { if (!cancelled && result && result.status === "coming-soon") setComingSoon({ placeName: result.placeName, joined: false }); })
      .catch((error: unknown) => console.error("Could not check whether this location is covered yet.", error));
    return () => { cancelled = true; };
  }, [origin]);

  async function joinWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await postJson("/api/waitlist", { email: form.get("email"), name: form.get("name"), source: "explore", contactTime: form.get("contactTime"), ...(origin.source === "postcode" ? { location: origin.label } : { lat: origin.lat, lng: origin.lng }) });
      setComingSoon((current) => current && { ...current, joined: true });
    } catch (error) {
      setToast(error instanceof Error ? error.message : "We couldn't save that. Please try again.");
    }
  }

  const nearby = useMemo(() => withDistance(content.places, origin), [content.places, origin]);
  const inRange = useMemo(() => nearby.filter((place) => place.miles <= radius), [nearby, radius]);
  const filteredPlaces = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rankNearby(inRange
      .filter((place) => selectedCategory === allNearby || matchesCategory(place, selectedCategory))
      .filter((place) => !search || `${place.name} ${place.category} ${place.details} ${place.address} ${(place.tags ?? []).join(" ")}`.toLowerCase().includes(search)));
  }, [inRange, query, selectedCategory]);
  const justOpened = useMemo(() => nearby.filter((place) => isSpotlight(place)).sort((a, b) => a.miles - b.miles), [nearby]);
  const favouritesNearby = useMemo(() => nearby.filter((place) => favourites.includes(place.id)).sort((a, b) => a.miles - b.miles), [nearby, favourites]);
  const recommended = useMemo(() => nearby
    .filter((place) => place.recommended || isSponsored(place))
    .sort((a, b) => Number(isSponsored(b)) - Number(isSponsored(a)) || a.miles - b.miles)
    .slice(0, 6), [nearby]);
  const essentials = useMemo(() => [
    { title: "Park up", places: nearestByCategory(nearby, "Parking", 3) },
    { title: "Cash & currency", places: nearestByCategory(nearby, "ATMs & Currency Exchange", 2) },
    { title: "Trains & buses", places: nearestByCategory(nearby, "Travel", 2) },
    { title: "Urgent care", places: nearestByCategory(nearby, "A&E", 1) },
  ], [nearby]);
  const thisWeekEvents = useMemo(() => eventsThisWeek(content.events), [content.events]);
  const updates = useMemo(() => [...content.updates].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || Date.parse(b.postedAt) - Date.parse(a.postedAt)), [content.updates]);
  const ratings = useMemo(() => {
    const totals: Record<string, { sum: number; count: number }> = {};
    for (const review of content.reviews) {
      totals[review.placeId] ??= { sum: 0, count: 0 };
      totals[review.placeId].sum += review.rating;
      totals[review.placeId].count += 1;
    }
    return totals;
  }, [content.reviews]);

  const currentPlace = selectedPlace ? nearby.find((place) => place.id === selectedPlace.id) ?? null : null;
  const originName = origin.source === "centre" ? area.name : origin.label;

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setLocationNotice("Your browser can't share a location. Enter a postcode instead.");
      return;
    }
    setLocating(true);
    setLocationNotice("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude, label: "Your location", source: "device" });
        setLocating(false);
        setToast("Showing what's closest to you");
      },
      (error) => {
        setLocating(false);
        setLocationNotice(error.code === error.PERMISSION_DENIED ? "Location access was blocked. Allow it in your browser, or enter a postcode instead." : "We couldn't find your location just now. Try again, or enter a postcode.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 },
    );
  }

  async function searchPostcode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = postcode.trim().toUpperCase();
    if (!isUkPostcode(value)) {
      setLocationNotice("Enter a full UK postcode, like CV11 4DZ.");
      return;
    }
    setLocating(true);
    setLocationNotice("");
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(value)}`);
      const result = await response.json() as { result?: { latitude: number | null; longitude: number | null; postcode: string } };
      if (!response.ok || result.result?.latitude == null || result.result.longitude == null) throw new Error("not found");
      setOrigin({ lat: result.result.latitude, lng: result.result.longitude, label: result.result.postcode, source: "postcode" });
      setPostcode("");
      setToast(`Showing what's near ${result.result.postcode}`);
    } catch {
      setLocationNotice("We couldn't find that postcode. Check it and try again.");
    } finally {
      setLocating(false);
    }
  }

  function showCategory(category: string) {
    setSelectedCategory(category);
    setTab("explore");
    window.setTimeout(() => document.getElementById("local-directory")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function copy(text: string, success: string) {
    void navigator.clipboard.writeText(text).then(() => setToast(success)).catch((error: unknown) => {
      console.error("Could not copy to clipboard.", error);
      setToast("Copy failed — please copy it manually.");
    });
  }

  function toggleFavourite(placeId: string) {
    setFavourites((current) => current.includes(placeId) ? current.filter((id) => id !== placeId) : [...current, placeId]);
    setToast(favourites.includes(placeId) ? "Removed from your favourites" : "Added to your favourites");
  }

  function markVisited(place: Place) {
    setVisited((current) => current.includes(place.id) ? current.filter((id) => id !== place.id) : [...current, place.id]);
    setToast(visited.includes(place.id) ? "Visit removed" : "Added to places you’ve been");
  }

  async function addReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewPlace) return;
    const form = new FormData(event.currentTarget);
    try {
      const result = await postJson("/api/reviews", { area: area.id, placeId: reviewPlace.id, author: form.get("author"), rating: Number(form.get("rating") ?? 5), text: form.get("review"), contactTime: form.get("contactTime") }) as { review?: PublicContent["reviews"][number] };
      if (result.review) setContent((current) => ({ ...current, reviews: [result.review!, ...current.reviews] }));
      setReviewPlace(null);
      setToast("Thanks for sharing with your neighbours!");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "We couldn't post your review.");
    }
  }

  return (
    <div className="app-shell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <a className="brand-lockup" href="/" aria-label="Near to me home"><BrandMark /><span>near to me<span className="brand-period">.</span></span></a>
        <div className="sidebar-location">
          <span className="location-label">SHOWING WHAT’S NEAR</span>
          <button className="location-select" onClick={() => { setTab("explore"); setMenuOpen(false); window.setTimeout(() => document.getElementById("location-bar")?.scrollIntoView({ behavior: "smooth" }), 0); }}><MapPin size={15} /><span>{origin.label}</span><LocateFixed size={15} /></button>
        </div>
        <div className="sidebar-section-title">DISCOVER</div>
        <nav className="primary-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setTab(id); setMenuOpen(false); }} className={tab === id ? "nav-link selected" : "nav-link"}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{id === "favourites" && favourites.length > 0 && <span className="nav-count">{favourites.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-section-title">FIND FAST</div>
        <nav className="primary-nav">
          {needs.slice(2, 5).map(({ label, category, icon: Icon }) => <button key={category} className="nav-link" onClick={() => { showCategory(category); setMenuOpen(false); }}><Icon size={18} /><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <button className="neighbour-card" onClick={() => { setTab("business"); setMenuOpen(false); }}>
            <span className="neighbour-card-icon"><Store size={16} /></span>
            <p><b>Are you a business?</b><br />Get featured & collect reviews.</p>
            <span className="neighbour-card-arrow"><ArrowRight size={16} /></span>
          </button>
          <button className="help-link" onClick={() => setToast("Near to me shows the good stuff closest to you. Use your location or a postcode to start.")}><CircleHelp size={17} /> Help & feedback</button>
          <a className="account-row" href="/account"><div className="avatar">{accountName ? accountName.slice(0, 1).toUpperCase() : "NT"}</div><div><b>{accountName || "Sign in / Join free"}</b><span>{accountName ? "Neighbour account" : "Your local life, a little closer"}</span></div><ChevronRight size={15} /></a>
        </div>
      </aside>
      {menuOpen && <button className="mobile-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}

      <main className="main-panel">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
          <a className="mobile-wordmark" href="/">near to me<span>.</span></a>
          <div className="breadcrumb"><span>Near to me</span><ChevronRight size={14} /><b>{tabTitles[tab]}</b></div>
          <div className="topbar-actions"><a className="topbar-account" href="/account">{accountName ? `Hi, ${accountName.split(" ")[0]}` : "Sign in"}</a><span className="status-dot" /> Live local guide <button className="share-top" onClick={() => copy(window.location.origin, "Link copied")}><Share2 size={15} /> Share</button></div>
        </header>

        <div className="content-wrap">
          {tab === "explore" && (
            <>
              <section className="local-hero">
                <div className="hero-topline"><span><i /> {area.name.toUpperCase()} & AROUND</span><button onClick={locateMe}><LocateFixed size={14} /> {origin.label}<ArrowUpRight size={13} /></button></div>
                <div className="hero-layout">
                  <div className="hero-copy">
                    <p className="hero-kicker">WHAT’S GOOD, CLOSEST TO YOU</p>
                    <h1>GOOD THINGS<br />ARE RIGHT<br /><span>AROUND</span> <i>YOU.</i></h1>
                    <p className="hero-description">Shops, food, gyms, parking and things to do — sorted by how close they are to where you are right now.</p>
                    <div className="hero-actions">
                      <button className="hero-cta" onClick={locateMe} disabled={locating}>{locating ? "FINDING YOU…" : "USE MY LOCATION"} <LocateFixed size={15} /></button>
                      <button className="hero-cta hero-cta-ghost" onClick={() => document.getElementById("local-directory")?.scrollIntoView({ behavior: "smooth" })}>EXPLORE NEARBY <ArrowDown size={15} /></button>
                    </div>
                  </div>
                  <div className="hero-map-art" aria-hidden="true">
                    <div className="hero-map-grid" />
                    <svg className="hero-streets" viewBox="0 0 560 440" fill="none">
                      <path className="hero-street-minor" d="M-25 79C79 109 116 25 218 73S367 151 582 67M-28 173C89 138 142 184 234 164s182-75 365-26M-25 308c97-85 177-29 244-58s123-114 212-95 93 43 153 38M38-20c20 106 105 130 75 235S60 362 157 478M229-30c-36 104 63 158 31 246s-23 142 49 240M416-30c-29 95 50 136 15 224s-27 160 60 246" />
                      <path className="hero-street-major" d="M-34 365c99-87 202-74 274-114s111-119 189-159 113-23 161-51M142-29c32 123 161 143 185 233s76 147 130 265" />
                      <path className="hero-route" d="M89 344c79-56 105-143 205-150s126-66 190-99" />
                    </svg>
                    <span className="hero-map-orbit orbit-one" /><span className="hero-map-orbit orbit-two" />
                    <span className="hero-map-pin pin-one"><MapPin size={20} fill="currentColor" /></span>
                    <span className="hero-map-pin pin-two"><MapPin size={17} fill="currentColor" /></span>
                    <span className="hero-map-pin pin-three"><MapPin size={15} fill="currentColor" /></span>
                    <div className="hero-town-marker"><span><LocateFixed size={18} /></span><b>{originName}</b><i>YOU ARE HERE</i></div>
                    {filteredPlaces[0] && <div className="hero-place-float"><span>01</span><div><b>{filteredPlaces[0].name}</b><small>{formatDistance(filteredPlaces[0].miles)} · {filteredPlaces[0].category}</small></div><ArrowUpRight size={15} /></div>}
                    <div className="hero-map-stamp">GOOD<br />THINGS<br /><span>NEARBY</span></div>
                  </div>
                </div>
                <div className="hero-bottomline"><span>SORTED BY DISTANCE</span><span>{inRange.length} PLACES <i>✳</i> WITHIN {radius} MI <i>✳</i> {thisWeekEvents.length} THINGS ON THIS WEEK</span><span>SCROLL TO EXPLORE <ArrowDown size={12} /></span></div>
              </section>

              <section className="location-bar" id="location-bar" aria-label="Choose where to search from">
                <div className="location-bar-current"><span className="location-bar-icon"><Navigation size={16} /></span><span><small>SHOWING WHAT’S CLOSEST TO</small><b>{origin.label}</b></span></div>
                <button className="location-bar-button" onClick={locateMe} disabled={locating}><LocateFixed size={15} /> {locating ? "Finding you…" : "Use my location"}</button>
                <form className="location-bar-postcode" onSubmit={searchPostcode}><input value={postcode} onChange={(event) => setPostcode(event.target.value)} placeholder="Or enter a postcode" aria-label="Postcode" autoComplete="postal-code" /><button type="submit" disabled={locating}>Go</button></form>
                <label className="location-bar-radius">WITHIN<select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>{radiusOptions.map((option) => <option key={option} value={option}>{option} mi</option>)}</select></label>
                {origin.source !== "centre" && <button className="location-bar-reset" onClick={() => setOrigin(townCentre)}>Use town centre</button>}
                {locationNotice && <p className="location-bar-notice" role="status">{locationNotice}</p>}
                {comingSoon && (
                  <div className="coming-soon" role="status">
                    <span className="coming-soon-icon"><Sparkles size={16} /></span>
                    <div className="coming-soon-copy"><b>Near to me is coming soon to {comingSoon.placeName}.</b><span>{comingSoon.joined ? "Thanks! We’ll email you as soon as it’s available there." : `We’re live in ${area.name} for now. Leave your email and we’ll tell you when your area launches.`}</span></div>
                    {!comingSoon.joined && <form className="coming-soon-form" onSubmit={joinWaitlist}><input name="name" placeholder="Your name (optional)" maxLength={80} autoComplete="name" aria-label="Your name" /><input name="email" type="email" required placeholder="you@example.com" maxLength={160} autoComplete="email" aria-label="Email address" /><input className="form-trap" name="contactTime" tabIndex={-1} autoComplete="off" aria-hidden="true" /><button type="submit">Tell me when it’s here</button></form>}
                  </div>
                )}
                <p className="location-bar-privacy"><ShieldCheck size={12} /> Your location stays on this device. Postcodes are looked up with postcodes.io.</p>
              </section>

              <section className="needs-section" aria-labelledby="needs-title">
                <div className="section-heading"><span className="section-index">01 / WHAT DO YOU NEED?</span><h2 id="needs-title">Closest to you, <i>right now.</i></h2></div>
                <div className="needs-grid">
                  {needs.map(({ label, category, icon: Icon, hint }) => {
                    const nearest = nearestByCategory(inRange, category, 1)[0];
                    return (
                      <button key={category} className="need-tile" onClick={() => showCategory(category)} style={{ ["--need" as string]: categoryColor(category) }}>
                        <span className="need-icon"><Icon size={18} /></span>
                        <b>{label}</b>
                        <small>{nearest ? `Nearest: ${nearest.name} · ${formatDistance(nearest.miles)}` : hint}</small>
                        <span className="need-count">{inRange.filter((place) => matchesCategory(place, category)).length} nearby <ArrowRight size={12} /></span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {justOpened.length > 0 && <PlaceStrip index="02 / FRESH ON THE HIGH STREET" title={<>Just opened, <i>go say hello.</i></>} intro="New places get a first-look spot for their opening weeks." places={justOpened} onSelect={setSelectedPlace} badge={() => <span className="spotlight-badge"><Sparkles size={10} /> JUST OPENED</span>} />}

              {favouritesNearby.length > 0 && <PlaceStrip index="03 / YOUR FAVOURITES" title={<>Your favourites, <i>nearest first.</i></>} intro="The places you’ve saved, sorted by how close they are to you now." places={favouritesNearby.slice(0, 6)} onSelect={setSelectedPlace} badge={() => <span className="spotlight-badge favourite-badge"><Heart size={10} fill="currentColor" /> FAVOURITE</span>} />}

              {recommended.length > 0 && <PlaceStrip index="04 / RECOMMENDED" title={<>Worth the trip, <i>from us.</i></>} intro="Picked by your local guide team. Sponsored places are always labelled." places={recommended} onSelect={setSelectedPlace} badge={(place) => isSponsored(place) ? <span className="spotlight-badge sponsored-badge"><Megaphone size={10} /> SPONSORED</span> : <span className="spotlight-badge recommended-badge"><BadgeCheck size={10} /> RECOMMENDED</span>} />}

              <section className="events-section" aria-labelledby="events-title">
                <div className="events-heading">
                  <div><span className="section-index">05 / MAKE A PLAN</span><h2 id="events-title">This week, <i>around here.</i></h2><p>Good things going on in {area.name} this week.</p></div>
                  <span className="events-date-stamp"><CalendarDays size={15} /> WEEKLY LOCAL EDIT</span>
                </div>
                <div className={showAllEvents ? "events-grid expanded" : "events-grid"}>
                  {thisWeekEvents.slice(0, showAllEvents ? thisWeekEvents.length : 4).map((event) => <EventCard key={event.id} event={event} date={event.eventDate} />)}
                  {thisWeekEvents.length === 0 && <p className="events-empty">Nothing listed for the rest of this week yet — check back soon.</p>}
                </div>
                {thisWeekEvents.length > 4 && <button className="events-more" onClick={() => setShowAllEvents((current) => !current)}>{showAllEvents ? "Show fewer events" : `See all ${thisWeekEvents.length} events`} <ArrowRight size={14} /></button>}
              </section>

              <div className="explore-heading" id="local-directory"><div><span className="section-index">06 / EVERYTHING NEARBY</span><h2>Right around <i>you.</i></h2><p>{filteredPlaces.length} places within {radius} mi <span>·</span> nearest first from {origin.label}</p></div><button className="text-button" onClick={() => setTab("favourites")}><Heart size={15} /> Your favourites <ArrowRight size={15} /></button></div>

              <div className="toolbar toolbar-docked">
                <label className="searchbox"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shops, food, gyms, parking…" /></label>
                <button className="filter-button" onClick={() => setRadius((value) => radiusOptions[(radiusOptions.indexOf(value) + 1) % radiusOptions.length])}><Filter size={16} /> Within {radius} mi</button>
              </div>
              <div className="category-rail">
                {[allNearby, ...categories].map((category) => <button key={category} className={selectedCategory === category ? "category-chip active" : "category-chip"} onClick={() => setSelectedCategory(category)}>
                  {category !== allNearby && <span className="category-dot" style={{ backgroundColor: categoryColor(category) }} />}{category}
                </button>)}
              </div>

              <div className="discovery-grid">
                <section className="map-column" aria-label="Nearby places map">
                  <div className="map-card">
                    <div className="map-top-controls"><span className="map-live"><span /> AROUND YOU · {radius} MI</span><button className="map-control-pill" onClick={locateMe}><LocateFixed size={14} /> Recenter on me</button></div>
                    <div className="neighborhood-map nearby-radar" style={{ ["--zoom" as string]: mapZoom }}>
                      <div className="radar-layer">
                        <span className="radar-ring ring-full" /><span className="radar-ring ring-half" /><span className="radar-ring ring-quarter" />
                        <span className="radar-label label-full">{radius} mi</span><span className="radar-label label-half">{radius / 2} mi</span>
                        <span className="radar-compass">N</span>
                        {filteredPlaces.slice(0, 60).map((place, index) => {
                          const point = projectToMap(origin, place, radius);
                          return (
                            <button key={place.id} className={`map-pin ${currentPlace?.id === place.id ? "map-pin-selected" : ""} ${index > 24 ? "map-pin-small" : ""}`} style={{ left: `${point.x}%`, top: `${point.y}%`, backgroundColor: categoryColor(place.category), ["--delay" as string]: `${index * 10}ms` }} onClick={() => setSelectedPlace(place)} title={`${place.name} · ${formatDistance(place.miles)}`} aria-label={`Show ${place.name}, ${formatDistance(place.miles)} away`}>
                              {currentPlace?.id === place.id ? <MapPin size={17} fill="currentColor" /> : <span />}
                            </button>
                          );
                        })}
                        <span className="radar-you"><span /><b>{origin.source === "centre" ? "Town centre" : "You"}</b></span>
                      </div>
                      <div className="map-zoom"><button onClick={() => setMapZoom((value) => Math.min(2, value + 0.2))} aria-label="Zoom in"><Plus size={19} /></button><button onClick={() => setMapZoom((value) => Math.max(1, value - 0.2))} aria-label="Zoom out"><Minus size={19} /></button></div>
                    </div>
                    <div className="map-legend">{["Food", "Shopping", "Gyms & fitness", "Parking", "Pubs & bars", "Attractions & days out"].map((item) => <span key={item}><i style={{ backgroundColor: categoryColor(item) }} />{item}</span>)}</div>
                  </div>
                  <div className="map-note"><ShieldCheck size={15} /><span>Distances are straight-line from {origin.label}, based on each place’s postcode. Always check with a business before you travel.</span></div>
                </section>
                <section className="place-list" aria-label="Nearby places">
                  <div className="list-heading"><span>NEAREST FIRST</span>{selectedCategory !== allNearby && <button onClick={() => setSelectedCategory(allNearby)}>Show everything <X size={13} /></button>}</div>
                  <div className="place-cards">
                    {filteredPlaces.slice(0, listLimit).map((place) => (
                      <article key={place.id} className={currentPlace?.id === place.id ? "place-card selected" : "place-card"}>
                        <button className="place-card-main" onClick={() => setSelectedPlace(place)}>
                          <span className="place-art" style={{ backgroundColor: `${categoryColor(place.category)}12`, color: categoryColor(place.category) }}><span>{placeGlyph(place.category)}</span></span>
                          <span className="place-copy">
                            <PlaceBadges place={place} />
                            <span className="place-category" style={{ color: categoryColor(place.category) }}>{place.category}</span>
                            <b>{place.name}</b>
                            <span className="place-address">{place.address}</span>
                            <span className="place-meta"><span><Navigation size={12} /> {formatDistance(place.miles)}</span><span className="meta-separator">·</span><span>{formatTravel(place.miles)}</span>{ratings[place.id] && <span className="rating-meta"><Star size={12} fill="currentColor" /> {(ratings[place.id].sum / ratings[place.id].count).toFixed(1)} ({ratings[place.id].count})</span>}</span>
                          </span>
                        </button>
                        <button className={favourites.includes(place.id) ? "save-place saved" : "save-place"} onClick={() => toggleFavourite(place.id)} aria-label={favourites.includes(place.id) ? `Remove ${place.name} from favourites` : `Add ${place.name} to favourites`}><Heart size={17} fill={favourites.includes(place.id) ? "currentColor" : "none"} /></button>
                      </article>
                    ))}
                    {filteredPlaces.length === 0 && <div className="empty-state"><Search size={22} /><b>Nothing found within {radius} mi</b><span>Try a wider distance, a different search or category.</span><button onClick={() => { setQuery(""); setSelectedCategory(allNearby); setRadius(10); }}>Widen the search</button></div>}
                  </div>
                  {filteredPlaces.length > listLimit && <button className="show-more" onClick={() => setListLimit((value) => value + 12)}>Show more nearby ({filteredPlaces.length - listLimit} left) <ArrowRight size={15} /></button>}
                </section>
              </div>

              <section className="essentials-section" aria-labelledby="essentials-title">
                <div className="section-heading"><span className="section-index">07 / VISITING?</span><h2 id="essentials-title">New in town? <i>Start here.</i></h2><p>Where to park, get cash, catch a train and get help — nearest to {origin.label}.</p></div>
                <div className="essentials-grid">
                  {essentials.map(({ title, places }) => (
                    <div className="essentials-card" key={title}>
                      <h3>{title}</h3>
                      {places.map((place) => <button key={place.id} onClick={() => setSelectedPlace(place)}><span><b>{place.name}</b><small>{tidy(place.details, 70) || place.address}</small></span><em>{formatDistance(place.miles)}</em></button>)}
                    </div>
                  ))}
                </div>
              </section>

              <section className="noticeboard" aria-labelledby="noticeboard-title">
                <div className="section-heading"><span className="section-index">08 / LOCAL NOTICEBOARD</span><h2 id="noticeboard-title">Updates & <i>recommendations.</i></h2><p>News, offers and tips from the {area.name} guide team.</p></div>
                {updates.length > 0 ? (
                  <div className="noticeboard-grid">
                    {updates.map((update) => {
                      const place = update.placeId ? nearby.find((item) => item.id === update.placeId) : undefined;
                      return (
                        <article className={`notice-card notice-${update.kind}`} key={update.id}>
                          <div className="notice-meta"><span>{update.pinned && "📌 "}{updateLabels[update.kind]}</span><span>{new Date(update.postedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></div>
                          <h3>{update.title}</h3>
                          <p>{update.body}</p>
                          <div className="notice-links">
                            {place && <button onClick={() => setSelectedPlace(place)}><MapPin size={12} /> {place.name} · {formatDistance(place.miles)}</button>}
                            {update.link && <a href={update.link} target="_blank" rel="noreferrer">Find out more <ExternalLink size={12} /></a>}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : <p className="events-empty">No updates right now. The guide team posts news, offers and recommendations here.</p>}
              </section>
            </>
          )}

          {tab === "favourites" && (
            <section className="simple-page">
              <p className="eyebrow">YOUR OWN LITTLE SHORTLIST</p><h1>Your favourites, <span>nearest first.</span></h1><p className="page-description">The places you love, sorted by how close they are to {origin.label}.</p>
              <div className="saved-toolbar"><span>{favourites.length} favourites · {visited.length} visited</span><button className="text-button" onClick={() => setTab("explore")}><ArrowLeft size={15} /> Back to explore</button></div>
              <div className="saved-grid">{favouritesNearby.map((place) => <SavedCard key={place.id} place={place} onRemove={toggleFavourite} onSelect={setSelectedPlace} />)}</div>
              {favouritesNearby.length === 0 && <div className="empty-state large"><Heart size={26} /><b>Your favourites start here</b><span>Tap the heart on any place to keep it close.</span><button onClick={() => setTab("explore")}>Explore nearby</button></div>}
              <div className="visited-section"><h2><Check size={18} /> Been there, loved that</h2><p>Keep track of the places you’ve visited.</p><div className="visited-chips">{nearby.filter((place) => visited.includes(place.id)).map((place) => <button className="visited-chip" key={place.id} onClick={() => setSelectedPlace(place)}>{place.name}<Check size={13} /></button>)}{visited.length === 0 && <span className="muted">Mark a place as visited from its details.</span>}</div></div>
            </section>
          )}

          {tab === "reviews" && (
            <section className="simple-page reviews-page">
              <p className="eyebrow">GOOD WORDS TRAVEL</p><h1>Local love, <span>shared.</span></h1><p className="page-description">Honest notes from people who know the neighbourhood best.</p>
              <div className="reviews-actions"><div className="review-stat"><b>{content.reviews.length}</b><span>community reviews</span></div><button className="primary-button" onClick={() => { setTab("explore"); setToast("Choose a place, then tap Write a review."); }}><MessageCircle size={16} /> Write a review</button></div>
              <div className="review-feed">{content.reviews.map((review) => <article className="review-card" key={review.id}><div className="review-avatar">{review.author.slice(0, 1).toUpperCase()}</div><div className="review-body"><div className="review-topline"><b>{review.author}</b><span>{new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span></div><ReviewStars rating={review.rating} /><p>{review.text}</p><button className="review-place-link" onClick={() => { const place = nearby.find((item) => item.id === review.placeId); if (place) setSelectedPlace(place); }}>{review.placeName}<ArrowUpRight size={13} /></button></div><button className="helpful-button" onClick={() => setToast("Thanks for finding this review helpful.")}><ThumbsUp size={15} /> Helpful</button></article>)}</div>
              {content.reviews.length === 0 && <div className="empty-state large"><MessageCircle size={26} /><b>Be the first to share a local tip</b><span>Your experience helps someone else find a new favourite.</span><button onClick={() => setTab("explore")}>Find a place to review</button></div>}
            </section>
          )}

          {tab === "business" && <BusinessContact onDone={(message) => setToast(message)} />}
        </div>
        <footer className="main-footer"><span>© 2026 Near to me</span><span>Made for the places that make a place. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span><button onClick={() => setTab("business")}>For local businesses <ArrowUpRight size={13} /></button></footer>
      </main>

      {currentPlace && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPlace(null); }}><section className="place-detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="modal-close" onClick={() => setSelectedPlace(null)} aria-label="Close"><X size={19} /></button><div className="detail-art" style={{ backgroundColor: `${categoryColor(currentPlace.category)}16` }}><span style={{ color: categoryColor(currentPlace.category) }}>{placeGlyph(currentPlace.category)}</span><span className="detail-category" style={{ color: categoryColor(currentPlace.category) }}>{currentPlace.category}</span></div><div className="detail-content"><p className="eyebrow">{formatDistance(currentPlace.miles).toUpperCase()} FROM {origin.label.toUpperCase()} <span>·</span> {formatTravel(currentPlace.miles).toUpperCase()}</p><h2 id="detail-title">{currentPlace.name}</h2><PlaceBadges place={currentPlace} /><p className="detail-address"><MapPin size={15} />{currentPlace.address}{currentPlace.approximateLocation && <small> (approximate location)</small>}</p><p className="detail-description">{tidy(currentPlace.details, 430)}</p>{isSpotlight(currentPlace) && currentPlace.spotlightNote && <p className="spotlight-detail"><Sparkles size={14} /><span><b>Just opened · local first look</b><small>{currentPlace.spotlightNote}</small></span></p>}{ratings[currentPlace.id] && <p className="detail-rating"><ReviewStars rating={Math.round(ratings[currentPlace.id].sum / ratings[currentPlace.id].count)} /> {ratings[currentPlace.id].count} local review{ratings[currentPlace.id].count === 1 ? "" : "s"}</p>}<div className="detail-actions"><button className="primary-button small-button" onClick={() => markVisited(currentPlace)}>{visited.includes(currentPlace.id) ? <><Check size={15} /> Been here</> : <><MapPin size={15} /> I’ve been here</>}</button><button className="outline-button" onClick={() => setReviewPlace(currentPlace)}><Star size={15} /> Write a review</button><button className="icon-outline" onClick={() => toggleFavourite(currentPlace.id)} aria-label={favourites.includes(currentPlace.id) ? "Remove from favourites" : "Add to favourites"}><Heart size={17} fill={favourites.includes(currentPlace.id) ? "currentColor" : "none"} /></button></div><a className="directions-link" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${currentPlace.name}, ${currentPlace.address}`)}${origin.source === "centre" ? "" : `&origin=${origin.lat},${origin.lng}`}`} target="_blank" rel="noreferrer">Get directions <ExternalLink size={14} /></a></div></section></div>}

      {reviewPlace && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewPlace(null); }}><section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title"><button className="modal-close" onClick={() => setReviewPlace(null)} aria-label="Close"><X size={19} /></button><span className="review-modal-icon"><MessageCircle size={21} /></span><p className="eyebrow">PASS THE GOOD WORD ALONG</p><h2 id="review-title">A note for {reviewPlace.name}.</h2><form onSubmit={addReview}><label className="field-label">YOUR RATING<div className="rating-input"><ReviewRatingInput /></div></label><label className="field-label">YOUR REVIEW<textarea name="review" required maxLength={1000} rows={4} placeholder="What should a neighbour know before they go?" /></label><label className="field-label">YOUR NAME <span className="optional">(optional)</span><input name="author" maxLength={60} placeholder="How should we credit you?" /></label><input className="form-trap" name="contactTime" tabIndex={-1} autoComplete="off" aria-hidden="true" /><button className="primary-button" type="submit">Share with your neighbours <ArrowRight size={16} /></button></form></section></div>}

      {toast && <div className="toast-message" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

function PlaceBadges({ place }: { place: Place }) {
  return (
    <>
      {isSpotlight(place) && <span className="spotlight-badge"><Sparkles size={10} /> JUST OPENED</span>}
      {isSponsored(place) && <span className="spotlight-badge sponsored-badge"><Megaphone size={10} /> SPONSORED</span>}
      {place.recommended && <span className="spotlight-badge recommended-badge"><BadgeCheck size={10} /> RECOMMENDED</span>}
      {place.tags?.includes("healthy") && <span className="spotlight-badge healthy-badge"><Salad size={10} /> HIGH PROTEIN / LOW CAL OPTIONS</span>}
    </>
  );
}

function PlaceStrip({ index, title, intro, places, onSelect, badge }: { index: string; title: React.ReactNode; intro: string; places: NearbyPlace[]; onSelect: (place: Place) => void; badge: (place: NearbyPlace) => React.ReactNode }) {
  return (
    <section className="just-opened">
      <div className="just-opened-heading"><span className="section-index">{index}</span><h2>{title}</h2><p>{intro}</p></div>
      <div className="just-opened-grid">
        {places.map((place) => (
          <button key={place.id} className="just-opened-card" onClick={() => onSelect(place)}>
            {badge(place)}
            <span className="place-category" style={{ color: categoryColor(place.category) }}>{place.category} · {formatDistance(place.miles)}</span>
            <b>{place.name}</b>
            <span className="place-address">{place.address}</span>
            <span className="just-opened-detail">{tidy(place.details, 96)}</span>
            <span className="just-opened-link">Take a look <ArrowUpRight size={13} /></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ReviewRatingInput() {
  const [rating, setRating] = useState(5);
  return <><ReviewStars rating={rating} onRate={setRating} /><input type="hidden" name="rating" value={rating} /></>;
}

function EventCard({ event, date }: { event: LocalEvent; date: Date }) {
  const postedLabel = event.posted ? new Date(`${event.posted}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(date);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue}, ${event.address}`)}`;
  return (
    <article className="event-card">
      <div className="event-date"><span>{dateLabel.split(" ")[0].toUpperCase()}</span><b>{date.getDate()}</b><small>{date.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</small></div>
      <div className="event-card-copy"><div className="event-meta"><span>{event.category}</span><span>{event.date ? "One night only" : `Every ${event.day}`} · {event.time}</span></div><h3>{event.title}</h3><p>{event.description}</p><a href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={12} /> {event.venue} <ArrowUpRight size={12} /></a><details><summary>More about this event</summary><p>{event.detail}</p><p className="event-posted">Posted by {event.host}{postedLabel && ` · ${postedLabel}`}</p></details></div>
    </article>
  );
}

function SavedCard({ place, onRemove, onSelect }: { place: NearbyPlace; onRemove: (id: string) => void; onSelect: (place: Place) => void }) {
  return <article className="saved-card"><button onClick={() => onSelect(place)}><span className="saved-card-icon" style={{ color: categoryColor(place.category), background: `${categoryColor(place.category)}15` }}><MapPin size={20} /></span><span className="place-category" style={{ color: categoryColor(place.category) }}>{place.category}</span><b>{place.name}</b><span className="place-address">{place.address}</span><span className="place-meta">{formatDistance(place.miles)} <span>·</span> {formatTravel(place.miles)}</span></button><button className="save-place saved" onClick={() => onRemove(place.id)} aria-label={`Remove ${place.name} from favourites`}><Heart size={17} fill="currentColor" /></button></article>;
}

function BusinessContact({ onDone }: { onDone: (message: string) => void }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ comingSoon?: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSending(true);
    setError("");
    try {
      const result = await postJson("/api/enquiries", { area: area.id, ...Object.fromEntries(new FormData(form)) }) as { comingSoon?: string };
      form.reset();
      setSent({ comingSoon: result.comingSoon });
      onDone("Thanks — the guide team will be in touch.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We couldn't send that. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="simple-page business-page">
      <p className="eyebrow">FOR LOCAL BUSINESSES</p><h1>Get seen by the people <span>right around you.</span></h1><p className="page-description">Near to me shows people what’s good and close by. Tell us about your business and the {area.name} guide team will get you set up.</p>
      <div className="feature-grid">
        <Feature icon={<Megaphone size={20} />} title="Get sponsored" text="Appear higher in nearby results and in Recommended. Sponsored spots are always clearly labelled." />
        <Feature icon={<Star size={20} />} title="Collect reviews" text="Locals can review you straight from your listing — great words travel." />
        <Feature icon={<Sparkles size={20} />} title="Just opened?" text="New openings sit at the top of the guide for their first three weeks." />
        <Feature icon={<CalendarDays size={20} />} title="Share what’s on" text="Quiz nights, live music and offers in This Week and on the noticeboard." />
      </div>
      <div className="business-contact">
        <div className="business-contact-copy"><h2>Talk to the guide team.</h2><p>No plans or tiers to pick. Tell us what you’d like and we’ll come back to you, usually within two working days.</p><ul><li><Check size={14} /> Listing a new or existing business</li><li><Check size={14} /> Sponsored placement</li><li><Check size={14} /> Reviews, events & offers</li></ul></div>
        {sent ? (
          <div className="business-contact-sent"><BadgeCheck size={26} /><b>Thanks, we’ve got it.</b><span>{sent.comingSoon ? `Near to me isn’t in ${sent.comingSoon} just yet, but it’s coming soon. We’ve saved your details and will email you as soon as it’s available there.` : `The ${area.name} guide team will reply by email.`}</span><button className="outline-button" onClick={() => setSent(null)}>Send another enquiry</button></div>
        ) : (
          <form className="business-contact-form" onSubmit={submit}>
            <label className="field-label">WHAT CAN WE HELP WITH?<select name="kind" defaultValue="sponsorship"><option value="sponsorship">Get sponsored / featured higher</option><option value="listing">List my business</option><option value="reviews">Reviews on my listing</option><option value="other">Something else</option></select></label>
            <div className="form-two"><label className="field-label">BUSINESS NAME<input name="businessName" required maxLength={120} /></label><label className="field-label">YOUR NAME<input name="contactName" required maxLength={80} autoComplete="name" /></label></div>
            <div className="form-two"><label className="field-label">EMAIL<input name="email" type="email" required maxLength={160} autoComplete="email" /></label><label className="field-label">PHONE <span className="optional">(optional)</span><input name="phone" type="tel" maxLength={40} autoComplete="tel" /></label></div>
            <label className="field-label">BUSINESS ADDRESS <span className="optional">(optional)</span><input name="address" maxLength={200} placeholder="Street, town, postcode" /></label>
            <label className="field-label">MESSAGE<textarea name="message" required maxLength={2000} rows={4} placeholder="What would you like to do? Opening date, events, offers…" /></label>
            <input className="form-trap" name="contactTime" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit" disabled={sending}>{sending ? "Sending…" : "Send to the guide team"} <ArrowRight size={16} /></button>
          </form>
        )}
      </div>
    </section>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <article className="feature-card"><span>{icon}</span><h3>{title}</h3><p>{text}</p></article>;
}
