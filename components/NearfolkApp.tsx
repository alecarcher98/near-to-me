"use client";

import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Copy,
  ExternalLink,
  Filter,
  Heart,
  LocateFixed,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Navigation,
  Plus,
  QrCode,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  ThumbsUp,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import originalPlaces from "@/data/places.json";

type Place = {
  id: string;
  name: string;
  category: string;
  distance: number;
  walkMinutes: number;
  details: string;
  address: string;
  x: number;
  y: number;
  rating?: number | null;
  ratingCount?: number;
};
type Review = {
  id: string;
  placeId: string;
  placeName: string;
  author: string;
  rating: number;
  text: string;
  date: string;
};
type Tab = "explore" | "saved" | "reviews" | "business" | "admin";

const categories = [
  "Everything nearby",
  "Food",
  "Shopping",
  "Parking",
  "ATMs & Currency Exchange",
  "Pubs & bars",
  "Attractions & days out",
  "Travel",
  "Laundry",
  "A&E",
];
const categoryColors: Record<string, string> = {
  Food: "#e5753b",
  Shopping: "#cf4c7b",
  Parking: "#4260c9",
  "ATMs & Currency Exchange": "#b48934",
  "Pubs & bars": "#a74b27",
  "Attractions & days out": "#178457",
  Travel: "#168a84",
  Laundry: "#7954c5",
  "A&E": "#d43d50",
};
const basePlaces = originalPlaces as Place[];
const navItems: { id: Tab; label: string; icon: typeof Compass }[] = [
  { id: "explore", label: "Explore places", icon: Compass },
  { id: "saved", label: "Your saved list", icon: Bookmark },
  { id: "reviews", label: "Local reviews", icon: MessageCircle },
];

function categoryColor(category: string) {
  return categoryColors[category] ?? "#188459";
}

function tidy(text: string, maximum = 118) {
  const result = text.replace(/what3words\s+\/\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
  return result.length > maximum ? `${result.slice(0, maximum).trim()}…` : result;
}

function BrandMark({ small = false }: { small?: boolean }) {
  return <span className={small ? "brand-mark brand-mark-small" : "brand-mark"}><MapPin size={small ? 17 : 20} fill="currentColor" /></span>;
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

export default function NearfolkApp() {
  const [tab, setTab] = useState<Tab>("explore");
  const [places, setPlaces] = useState<Place[]>(basePlaces);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [baseLocation, setBaseLocation] = useState("Nuneaton, UK");
  const [areas, setAreas] = useState(["Nuneaton, UK"]);
  const [newArea, setNewArea] = useState("");
  const [radius, setRadius] = useState(5);
  const [company, setCompany] = useState("The Nuneaton Welcome Guide");
  const [companyUrl, setCompanyUrl] = useState("nuneaton.nearfolk.co.uk");
  const [subscription, setSubscription] = useState("Free");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Everything nearby");
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [reviewPlace, setReviewPlace] = useState<Place | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [showAllPins, setShowAllPins] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Food");
  const [newAddress, setNewAddress] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    try {
      const read = <T,>(key: string, fallback: T): T => {
        const value = window.localStorage.getItem(`nearfolk:${key}`);
        return value ? (JSON.parse(value) as T) : fallback;
      };
      setPlaces(read("places", basePlaces));
      setReviews(read("reviews", []));
      setSaved(read("saved", []));
      setVisited(read("visited", []));
      setBaseLocation(read("baseLocation", "Nuneaton, UK"));
      setAreas(read("areas", ["Nuneaton, UK"]));
      setRadius(read("radius", 5));
      setCompany(read("company", "The Nuneaton Welcome Guide"));
      setCompanyUrl(read("companyUrl", "nuneaton.nearfolk.co.uk"));
      setSubscription(read("subscription", "Free"));
    } catch (error) {
      console.error("Could not load Nearfolk settings from this browser.", error);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const state = { places, reviews, saved, visited, baseLocation, areas, radius, company, companyUrl, subscription };
    Object.entries(state).forEach(([key, value]) => window.localStorage.setItem(`nearfolk:${key}`, JSON.stringify(value)));
  }, [places, reviews, saved, visited, baseLocation, areas, radius, company, companyUrl, subscription, isLoaded]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredPlaces = useMemo(() => {
    return places
      .filter((place) => selectedCategory === "Everything nearby" || place.category === selectedCategory)
      .filter((place) => `${place.name} ${place.category} ${place.details} ${place.address}`.toLowerCase().includes(query.toLowerCase()))
      .filter((place) => place.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }, [places, query, radius, selectedCategory]);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/widget?company=${encodeURIComponent(companyUrl)}` : "https://nearfolk.com/widget";
  const widgetSnippet = `<iframe src="${shareUrl}" title="${company} local guide" width="100%" height="760" loading="lazy" style="border:0;border-radius:20px"></iframe>`;
  const currentPlace = selectedPlace ? places.find((place) => place.id === selectedPlace.id) ?? selectedPlace : null;

  function copy(text: string, success: string) {
    void navigator.clipboard.writeText(text).then(() => setToast(success)).catch((error: unknown) => {
      console.error("Could not copy to clipboard.", error);
      setToast("Copy failed — please copy it manually.");
    });
  }

  function toggleSaved(placeId: string) {
    setSaved((current) => current.includes(placeId) ? current.filter((id) => id !== placeId) : [...current, placeId]);
    setToast(saved.includes(placeId) ? "Removed from your saved list" : "Saved for later");
  }

  function addReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewPlace) return;
    const form = new FormData(event.currentTarget);
    const text = String(form.get("review") ?? "").trim();
    const author = String(form.get("author") ?? "").trim() || "Local explorer";
    const rating = Number(form.get("rating") ?? 5);
    if (!text) {
      setToast("Add a few words before posting your review.");
      return;
    }
    setReviews((current) => [{ id: `${Date.now()}`, placeId: reviewPlace.id, placeName: reviewPlace.name, author, rating, text, date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) }, ...current]);
    setReviewPlace(null);
    setToast("Thanks for sharing with your neighbours!");
  }

  function markVisited(place: Place) {
    setVisited((current) => current.includes(place.id) ? current.filter((id) => id !== place.id) : [...current, place.id]);
    setToast(visited.includes(place.id) ? "Visit removed" : "Added to places you’ve been");
  }

  function addPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim() || !newAddress.trim()) return;
    const seed = newName.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const slug = `${newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString().slice(-5)}`;
    setPlaces((current) => [...current, {
      id: slug,
      name: newName.trim(),
      category: newCategory,
      distance: Math.max(0.1, ((seed % 35) + 10) / 10),
      walkMinutes: Math.max(2, Math.round(((seed % 35) + 10) / 10 * 20)),
      details: newDescription.trim() || "A local place, added by the area guide administrator.",
      address: newAddress.trim(),
      x: 20 + seed % 65,
      y: 18 + (seed * 3) % 66,
    }]);
    setNewName("");
    setNewAddress("");
    setNewDescription("");
    setToast("Your local place has been added.");
  }

  function removePlace(placeId: string) {
    setPlaces((current) => current.filter((place) => place.id !== placeId));
    setToast("Place removed from this guide.");
  }

  return (
    <div className="app-shell">
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <a className="brand-lockup" href="/" aria-label="Nearfolk home"><BrandMark /><span>nearfolk<span className="brand-period">.</span></span></a>
        <div className="sidebar-location">
          <span className="location-label">YOUR LOCAL GUIDE</span>
          <button className="location-select" onClick={() => setTab("admin")}><MapPin size={15} /><span>{baseLocation}</span><ChevronDown size={15} /></button>
        </div>
        <div className="sidebar-section-title">DISCOVER</div>
        <nav className="primary-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setTab(id); setMenuOpen(false); }} className={tab === id ? "nav-link selected" : "nav-link"}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{id === "saved" && saved.length > 0 && <span className="nav-count">{saved.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-section-title">FOR YOUR BUSINESS</div>
        <nav className="primary-nav">
          <button className={tab === "business" ? "nav-link selected" : "nav-link"} onClick={() => { setTab("business"); setMenuOpen(false); }}><Store size={18} /><span>Business toolkit</span></button>
          <button className={tab === "admin" ? "nav-link selected" : "nav-link"} onClick={() => { setTab("admin"); setMenuOpen(false); }}><Settings2 size={18} /><span>Area admin</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="neighbour-card">
            <span className="neighbour-card-icon"><Sparkles size={16} /></span>
            <p><b>Know a lovely local?</b><br />Help your neighbourhood shine.</p>
            <button onClick={() => { setNewName(""); setTab("admin"); }} aria-label="Suggest a local place"><ArrowRight size={16} /></button>
          </div>
          <button className="help-link" onClick={() => setToast("Nearfolk brings your local guide and community together.")}><CircleHelp size={17} /> Help & feedback</button>
          <div className="account-row"><div className="avatar">NF</div><div><b>Neighbour account</b><span>Free explorer</span></div><ChevronDown size={15} /></div>
        </div>
      </aside>
      {menuOpen && <button className="mobile-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}

      <main className="main-panel">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="breadcrumb"><span>Nearfolk</span><ChevronRight size={14} /><b>{tab === "explore" ? "Explore" : tab === "saved" ? "Saved places" : tab === "reviews" ? "Local reviews" : tab === "business" ? "Business toolkit" : "Area admin"}</b></div>
          <div className="topbar-actions"><span className="status-dot" /> Live local guide <button className="share-top" onClick={() => copy(shareUrl, "Guide link copied")}><Share2 size={15} /> Share guide</button></div>
        </header>

        <div className="content-wrap">
          {tab === "explore" && (
            <>
              <div className="welcome-row">
                <div><p className="eyebrow">A LITTLE CLOSER TO HOME</p><h1>Find your kind of <span>nearby.</span></h1><p className="welcome-sub">Good places, useful stops and local favourites around <b>{baseLocation.split(",")[0]}</b>.</p></div>
                <button className="location-pill" onClick={() => setTab("admin")}><LocateFixed size={16} /><span>{baseLocation}</span><ChevronDown size={15} /></button>
              </div>

              <div className="toolbar">
                <label className="searchbox"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search places, food, parking…" /><kbd>⌘ K</kbd></label>
                <button className="filter-button" onClick={() => setRadius((value) => value === 1 ? 5 : value === 5 ? 10 : 1)}><Filter size={16} /> Within {radius} mi <ChevronDown size={14} /></button>
              </div>

              <div className="category-rail">
                {categories.map((category) => <button key={category} className={selectedCategory === category ? "category-chip active" : "category-chip"} onClick={() => setSelectedCategory(category)}>
                  {category !== "Everything nearby" && <span className="category-dot" style={{ backgroundColor: categoryColor(category) }} />}{category}
                </button>)}
              </div>

              <div className="explore-heading"><div><h2>All around you</h2><p>{filteredPlaces.length} local places <span>·</span> refreshed for {baseLocation.split(",")[0]}</p></div><button className="text-button" onClick={() => setTab("saved")}><Bookmark size={15} /> Your saved list <ArrowRight size={15} /></button></div>

              <div className="discovery-grid">
                <section className="map-column" aria-label="Nearby places map">
                  <div className="map-card">
                    <div className="map-top-controls"><span className="map-live"><span /> NEARBY MAP</span><button className="map-control-pill" onClick={() => setShowAllPins((value) => !value)}><Map size={14} /> {showAllPins ? "All places" : "Selected category"}</button><button className="map-control-pill" onClick={() => setToast(`Showing places within ${radius} miles of ${baseLocation}.`)}><LocateFixed size={14} /> Recenter</button></div>
                    <div className="neighborhood-map" style={{ ["--zoom" as string]: mapZoom }}>
                      <svg className="map-art" viewBox="0 0 760 590" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                        <path d="M-50 105 C110 124 145 80 265 133 S450 220 790 96" /><path d="M-40 220 C98 184 174 200 280 250 S535 350 810 260" /><path d="M-40 386 C110 330 205 375 330 420 S565 465 800 393" /><path d="M115 -25 C128 128 183 205 140 320 S136 479 185 620" /><path d="M335 -30 C285 92 382 176 354 294 S310 478 367 620" /><path d="M536 -20 C493 93 554 193 520 293 S510 466 572 620" />
                        <path className="road-major" d="M-50 462 C125 427 177 362 257 328 S405 273 510 183 S665 98 810 64" /><path className="road-major" d="M211 -20 C230 122 343 189 406 249 S547 373 625 610" /><path className="river" d="M-30 295 C122 300 180 262 286 295 S498 375 786 327" />
                      </svg>
                      <span className="map-label label-one">Riverside Walk</span><span className="map-label label-two">Market Place</span><span className="map-label label-three">Abbey Green</span><span className="map-label label-four">Queens Road</span>
                      <div className="map-park park-one" /><div className="map-park park-two" />
                      {filteredPlaces.slice(0, showAllPins ? 42 : 22).map((place, index) => (
                        <button key={place.id} className={`map-pin ${currentPlace?.id === place.id ? "map-pin-selected" : ""} ${index > 23 ? "map-pin-small" : ""}`} style={{ left: `${place.x}%`, top: `${place.y}%`, backgroundColor: categoryColor(place.category), ["--delay" as string]: `${index * 10}ms` }} onClick={() => setSelectedPlace(place)} title={place.name} aria-label={`Show ${place.name} on map`}>
                          {currentPlace?.id === place.id ? <MapPin size={17} fill="currentColor" /> : <span />}
                        </button>
                      ))}
                      <button className="hotel-pin" style={{ left: "50%", top: "48%" }} onClick={() => setToast(`${baseLocation.split(",")[0]} local area`)}><span className="hotel-pin-letter">N</span><span className="hotel-pin-name">{baseLocation.split(",")[0]}</span></button>
                      <div className="map-zoom"><button onClick={() => setMapZoom((value) => Math.min(1.6, value + 0.1))} aria-label="Zoom in"><Plus size={19} /></button><button onClick={() => setMapZoom((value) => Math.max(0.8, value - 0.1))} aria-label="Zoom out"><Minus size={19} /></button></div>
                      <div className="map-scale"><span>© OpenStreetMap</span></div>
                    </div>
                    <div className="map-legend">{["Food", "Shopping", "Parking", "ATMs & Currency Exchange", "Pubs & bars", "Attractions & days out"].map((item) => <span key={item}><i style={{ backgroundColor: categoryColor(item) }} />{item}</span>)}</div>
                  </div>
                  <div className="map-note"><ShieldCheck size={15} /><span>Community-powered local info. Always check with a business before you travel.</span><button onClick={() => setTab("admin")}>Manage this area <ArrowUpRight size={14} /></button></div>
                </section>
                <section className="place-list" aria-label="Nearby places">
                  <div className="list-heading"><span>THE LOCAL EDIT</span><button onClick={() => setSelectedCategory("Everything nearby")}>View map <ArrowUpRight size={14} /></button></div>
                  <div className="place-cards">
                    {filteredPlaces.slice(0, 12).map((place, index) => (
                      <article key={place.id} className={currentPlace?.id === place.id ? "place-card selected" : "place-card"}>
                        <button className="place-card-main" onClick={() => setSelectedPlace(place)}>
                          <span className="place-art" style={{ backgroundColor: `${categoryColor(place.category)}12`, color: categoryColor(place.category) }}><span>{place.category === "Food" ? "✳" : place.category === "Shopping" ? "◇" : place.category === "Parking" ? "P" : place.category === "Attractions & days out" ? "✦" : place.category === "Pubs & bars" ? "◒" : "⌖"}</span></span>
                          <span className="place-copy"><span className="place-category" style={{ color: categoryColor(place.category) }}>{place.category}</span><b>{place.name}</b><span className="place-address">{place.address || place.details}</span><span className="place-meta"><span><Navigation size={12} /> {place.distance < 0.1 ? "<0.1" : place.distance.toFixed(1)} mi</span><span className="meta-separator">·</span><span>{place.walkMinutes} min walk</span>{reviews.some((review) => review.placeId === place.id) && <span className="rating-meta"><Star size={12} fill="currentColor" /> {reviews.filter((review) => review.placeId === place.id).length} review</span>}</span></span>
                        </button>
                        <button className={saved.includes(place.id) ? "save-place saved" : "save-place"} onClick={() => toggleSaved(place.id)} aria-label={saved.includes(place.id) ? `Unsave ${place.name}` : `Save ${place.name}`}><Bookmark size={17} fill={saved.includes(place.id) ? "currentColor" : "none"} /></button>
                        {index === 2 && <div className="local-pick"><Sparkles size={12} /> NEIGHBOURHOOD PICK</div>}
                      </article>
                    ))}
                    {filteredPlaces.length === 0 && <div className="empty-state"><Search size={22} /><b>No places found</b><span>Try a different search or category.</span><button onClick={() => { setQuery(""); setSelectedCategory("Everything nearby"); }}>Clear filters</button></div>}
                  </div>
                  {filteredPlaces.length > 12 && <button className="show-more" onClick={() => setTab("saved")}>Browse all {filteredPlaces.length} nearby places <ArrowRight size={15} /></button>}
                </section>
              </div>
              <div className="bottom-banner"><span className="banner-spark">✳</span><div><b>Make this neighbourhood yours.</b><span>Save places, share a local tip, and help your guide grow.</span></div><button onClick={() => setTab("reviews")}>Share a local tip <ArrowRight size={15} /></button></div>
            </>
          )}

          {tab === "saved" && (
            <section className="simple-page">
              <p className="eyebrow">YOUR OWN LITTLE SHORTLIST</p><h1>Places for <span>later.</span></h1><p className="page-description">A handy list of the places you want to come back to.</p>
              <div className="saved-toolbar"><span>{saved.length} saved places · {visited.length} visited</span><button className="text-button" onClick={() => setTab("explore")}><ArrowLeft size={15} /> Back to explore</button></div>
              <div className="saved-grid">{places.filter((place) => saved.includes(place.id)).map((place) => <SavedCard key={place.id} place={place} saved={saved} onSave={toggleSaved} onSelect={setSelectedPlace} />)}</div>
              {saved.length === 0 && <div className="empty-state large"><Bookmark size={26} /><b>Your shortlist starts here</b><span>Tap the bookmark on any local place to keep it close.</span><button onClick={() => setTab("explore")}>Explore nearby</button></div>}
              <div className="visited-section"><h2><Check size={18} /> Been there, loved that</h2><p>Keep track of the places you’ve visited.</p><div className="visited-chips">{places.filter((place) => visited.includes(place.id)).map((place) => <button className="visited-chip" key={place.id} onClick={() => setSelectedPlace(place)}>{place.name}<Check size={13} /></button>)}{visited.length === 0 && <span className="muted">Mark a place as visited from its details.</span>}</div></div>
            </section>
          )}

          {tab === "reviews" && (
            <section className="simple-page reviews-page">
              <p className="eyebrow">GOOD WORDS TRAVEL</p><h1>Local love, <span>shared.</span></h1><p className="page-description">Honest notes from people who know the neighbourhood best.</p>
              <div className="reviews-actions"><div className="review-stat"><b>{reviews.length}</b><span>community reviews</span></div><button className="primary-button" onClick={() => { setTab("explore"); setToast("Choose a place, then tap Write a review."); }}><MessageCircle size={16} /> Write a review</button></div>
              <div className="review-feed">{reviews.map((review) => <article className="review-card" key={review.id}><div className="review-avatar">{review.author.slice(0, 1).toUpperCase()}</div><div className="review-body"><div className="review-topline"><b>{review.author}</b><span>{review.date}</span></div><ReviewStars rating={review.rating} /><p>{review.text}</p><button className="review-place-link" onClick={() => { const place = places.find((item) => item.id === review.placeId); if (place) setSelectedPlace(place); }}>{review.placeName}<ArrowUpRight size={13} /></button></div><button className="helpful-button" onClick={() => setToast("Thanks for finding this review helpful.")}><ThumbsUp size={15} /> Helpful</button></article>)}</div>
              {reviews.length === 0 && <div className="empty-state large"><MessageCircle size={26} /><b>Be the first to share a local tip</b><span>Your experience helps someone else find a new favourite.</span><button onClick={() => setTab("explore")}>Find a place to review</button></div>}
            </section>
          )}

          {tab === "business" && (
            <section className="simple-page business-page">
              <p className="eyebrow">YOUR DOORWAY TO THE NEIGHBOURHOOD</p><h1>Bring the local <span>good stuff.</span></h1><p className="page-description">Give every guest a thoughtful guide to the places, people and experiences around your door.</p>
              <div className="business-hero"><div className="business-hero-copy"><span className="business-tag"><Sparkles size={14} /> THE NEARFOLK BUSINESS TOOLKIT</span><h2>More than a list.<br />A better welcome.</h2><p>One local guide, ready for your website, welcome email or front desk QR code. Keep the whole neighbourhood in the picture.</p><button className="primary-button" onClick={() => setTab("admin")}>Set up your guide <ArrowRight size={16} /></button></div><div className="business-hero-visual"><span className="visual-sun" /><span className="visual-building"><span /><span /><span /></span><span className="visual-pin"><MapPin fill="currentColor" size={30} /></span><div className="visual-float visual-float-one"><span className="float-icon">✳</span><span><b>Good coffee</b><small>2 min around the corner</small></span></div><div className="visual-float visual-float-two"><span className="float-icon green">✦</span><span><b>Market mornings</b><small>Local favourite</small></span></div></div></div>
              <div className="feature-grid"><Feature icon={<QrCode size={20} />} title="One scan. Your whole area." text="Create a branded QR code that takes guests straight to your nearby guide." /><Feature icon={<Map size={20} />} title="Your place, your radius." text="Set your base location and service area. Keep local recommendations relevant." /><Feature icon={<Share2 size={20} />} title="Fits right in." text="Embed the responsive guide on your own site, or share a clean link anywhere." /><Feature icon={<Heart size={20} />} title="Real local love." text="Guests can save places, mark a visit and leave a review from any device." /></div>
              <div className="plan-heading"><div><p className="eyebrow">PICK YOUR PACE</p><h2>Simple plans for local champions.</h2></div><span className="billing-label">Cancel any time</span></div>
              <div className="plans-grid">{[{ name: "Free", price: "£0", note: "For getting started", features: ["Local places directory", "Shareable guest guide", "Community reviews"] }, { name: "Neighbour", price: "£12", note: "per location / month", features: ["Everything in Free", "Branded QR code", "Website embed", "Custom base location"] }, { name: "Good Neighbour", price: "£29", note: "per location / month", features: ["Everything in Neighbour", "Customise your guide", "Multiple local areas", "Priority support"] }].map((plan) => <article className={`plan-card ${plan.name === "Neighbour" ? "plan-featured" : ""}`} key={plan.name}>{plan.name === "Neighbour" && <span className="plan-ribbon">MOST LOVED</span>}<h3>{plan.name}</h3><div className="plan-price">{plan.price}<span>{plan.price !== "£0" ? "/mo" : ""}</span></div><p className="plan-note">{plan.note}</p><ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul><button className={subscription === plan.name ? "plan-button current" : "plan-button"} onClick={() => { setSubscription(plan.name); setToast(`${plan.name} plan selected. Billing is in preview mode.`); }}>{subscription === plan.name ? <><Check size={15} /> Current plan</> : `Choose ${plan.name}`}</button></article>)}</div>
              <div className="business-cta"><div><span className="eyebrow">READY TO WELCOME THEM IN?</span><h2>Your area deserves a good guide.</h2></div><button className="primary-button" onClick={() => setTab("admin")}>Set up your local guide <ArrowRight size={16} /></button></div>
            </section>
          )}

          {tab === "admin" && (
            <section className="simple-page admin-page">
              <p className="eyebrow">AREA MANAGER</p><h1>Your neighbourhood, <span>in good hands.</span></h1><p className="page-description">Set your local anchor, keep the guide up to date and get your guest-ready QR code.</p>
              <div className="admin-stats"><Stat icon={<MapPin size={18} />} label="Local places" value={String(places.length)} detail="Across your guide" /><Stat icon={<Users size={18} />} label="Your area" value={baseLocation.split(",")[0]} detail={`Within ${radius} miles`} /><Stat icon={<MessageCircle size={18} />} label="Community voice" value={String(reviews.length)} detail="Reviews shared" /><Stat icon={<Activity size={18} />} label="Your plan" value={subscription} detail="Preview mode" /></div>
              <div className="admin-grid">
                <div className="admin-main-column">
                  <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon"><LocateFixed size={18} /></span><div><h2>Set your local area</h2><p>Your base point keeps all recommendations close to home.</p></div></div><label className="field-label">BASE LOCATION<input value={baseLocation} onChange={(event) => setBaseLocation(event.target.value)} onBlur={() => setAreas((current) => current.includes(baseLocation) ? current : [...current, baseLocation])} placeholder="e.g. Nuneaton, UK" /></label><div className="form-two"><label className="field-label">DIRECTORY RADIUS<select value={radius} onChange={(event) => setRadius(Number(event.target.value))}><option value={1}>1 mile</option><option value={3}>3 miles</option><option value={5}>5 miles</option><option value={10}>10 miles</option></select></label><label className="field-label">ACTIVE LOCAL AREA<select value={baseLocation} onChange={(event) => setBaseLocation(event.target.value)}>{Array.from(new Set([...areas, baseLocation])).map((area) => <option key={area} value={area}>{area}</option>)}</select></label></div><label className="field-label">ADD ANOTHER LOCAL AREA<div className="domain-input"><input value={newArea} onChange={(event) => setNewArea(event.target.value)} placeholder="e.g. Hinckley, UK" /><button className="area-add-button" type="button" onClick={() => { const area = newArea.trim(); if (!area) return; setAreas((current) => current.includes(area) ? current : [...current, area]); setBaseLocation(area); setNewArea(""); setToast(`${area} area added to your guide.`); }}><Plus size={15} /> Add area</button></div></label><div className="inline-notice"><ShieldCheck size={15} /> Changes save on this device and update your guide instantly. This preview uses the supplied Nuneaton directory; changing areas does not geocode or fetch new listings.</div></section>
                  <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon purple"><Store size={18} /></span><div><h2>Your guest guide</h2><p>Make the directory feel like it belongs to your place.</p></div></div><label className="field-label">GUIDE NAME<input value={company} onChange={(event) => setCompany(event.target.value)} /></label><label className="field-label">CUSTOM GUIDE ADDRESS<div className="domain-input"><span>https://</span><input value={companyUrl} onChange={(event) => setCompanyUrl(event.target.value)} /></div></label><div className="embed-code"><div><span>WEBSITE EMBED</span><button onClick={() => copy(widgetSnippet, "Embed code copied")}><Copy size={14} /> Copy code</button></div><code>{widgetSnippet}</code></div></section>
                  <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon yellow"><Map size={18} /></span><div><h2>Manage local places <span className="count-badge">{places.length}</span></h2><p>Add something wonderful, or remove information that’s no longer current.</p></div></div>
                    <form className="add-place-form" onSubmit={addPlace}><h3><Plus size={16} /> Add a local place</h3><div className="form-two"><label className="field-label">PLACE NAME<input required value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. The Sunday market" /></label><label className="field-label">CATEGORY<select value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>{categories.slice(1).map((category) => <option key={category}>{category}</option>)}</select></label></div><label className="field-label">ADDRESS<input required value={newAddress} onChange={(event) => setNewAddress(event.target.value)} placeholder="Street, town, postcode" /></label><label className="field-label">SHORT DESCRIPTION<textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="What makes this place worth a visit?" rows={2} /></label><button className="primary-button small-button" type="submit"><Plus size={15} /> Add place to guide</button></form>
                    <div className="admin-place-list">{places.slice(-4).reverse().map((place) => <div className="admin-place-row" key={place.id}><span className="admin-place-dot" style={{ backgroundColor: categoryColor(place.category) }} /><span><b>{place.name}</b><small>{place.category} · {place.address}</small></span>{!basePlaces.some((item) => item.id === place.id) && <button onClick={() => removePlace(place.id)} aria-label={`Remove ${place.name}`}><Trash2 size={15} /></button>}</div>)}</div></section>
                </div>
                <aside className="admin-side-column">
                  <section className="qr-card"><span className="qr-label"><QrCode size={15} /> YOUR GUEST QR</span><h2>Ready to scan.<br />Ready to explore.</h2><p>Put your local guide right where your guests need it.</p><div className="qr-frame"><QRCodeSVG value={shareUrl} size={160} bgColor="#ffffff" fgColor="#102d25" level="H" includeMargin /></div><div className="qr-meta"><b>{company}</b><span>{companyUrl}</span></div><button className="qr-download" onClick={() => { const svg = document.querySelector(".qr-frame svg"); if (!svg) return; const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "nearfolk-guest-guide.svg"; link.click(); URL.revokeObjectURL(link.href); setToast("Your QR code is ready to use."); }}><Upload size={15} /> Download QR code</button><button className="qr-share" onClick={() => copy(shareUrl, "QR guide link copied")}>Copy guide link <Copy size={14} /></button></section>
                  <section className="launch-card"><span className="launch-icon"><Sparkles size={17} /></span><h3>It’s a good day to go local.</h3><p>Your QR code and embed show the same live list, so every update reaches your guests.</p><a href="/widget" target="_blank">Preview your guide <ArrowUpRight size={14} /></a></section>
                  <section className="admin-help"><ShieldCheck size={17} /><div><b>Local-first by design</b><p>This preview stores your edits in this browser. Add a hosted database and geocoding service before launching to multiple live business accounts.</p></div></section>
                </aside>
              </div>
            </section>
          )}
        </div>
        <footer className="main-footer"><span>© 2025 Nearfolk</span><span>Made for the places that make a place.</span><button onClick={() => setTab("business")}>For local businesses <ArrowUpRight size={13} /></button></footer>
      </main>

      {currentPlace && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPlace(null); }}><section className="place-detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="modal-close" onClick={() => setSelectedPlace(null)} aria-label="Close"><X size={19} /></button><div className="detail-art" style={{ backgroundColor: `${categoryColor(currentPlace.category)}16` }}><span style={{ color: categoryColor(currentPlace.category) }}>{currentPlace.category === "Food" ? "✳" : currentPlace.category === "Shopping" ? "◇" : "✦"}</span><span className="detail-category" style={{ color: categoryColor(currentPlace.category) }}>{currentPlace.category}</span></div><div className="detail-content"><p className="eyebrow">{currentPlace.distance.toFixed(1)} MI FROM YOUR LOCAL GUIDE <span>·</span> {currentPlace.walkMinutes} MIN WALK</p><h2 id="detail-title">{currentPlace.name}</h2><p className="detail-address"><MapPin size={15} />{currentPlace.address || currentPlace.details}</p><p className="detail-description">{tidy(currentPlace.details, 430)}</p><div className="detail-actions"><button className="primary-button small-button" onClick={() => markVisited(currentPlace)}>{visited.includes(currentPlace.id) ? <><Check size={15} /> Been here</> : <><MapPin size={15} /> I’ve been here</>}</button><button className="outline-button" onClick={() => setReviewPlace(currentPlace)}><Star size={15} /> Write a review</button><button className="icon-outline" onClick={() => toggleSaved(currentPlace.id)} aria-label="Save place"><Bookmark size={17} fill={saved.includes(currentPlace.id) ? "currentColor" : "none"} /></button></div><a className="directions-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${currentPlace.name} ${currentPlace.address}`)}`} target="_blank" rel="noreferrer">Get directions <ExternalLink size={14} /></a></div></section></div>}

      {reviewPlace && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewPlace(null); }}><section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title"><button className="modal-close" onClick={() => setReviewPlace(null)} aria-label="Close"><X size={19} /></button><span className="review-modal-icon"><MessageCircle size={21} /></span><p className="eyebrow">PASS THE GOOD WORD ALONG</p><h2 id="review-title">A note for {reviewPlace.name}.</h2><form onSubmit={addReview}><label className="field-label">YOUR RATING<div className="rating-input"><ReviewRatingInput /></div></label><label className="field-label">YOUR REVIEW<textarea name="review" required rows={4} placeholder="What should a neighbour know before they go?" /></label><label className="field-label">YOUR NAME <span className="optional">(optional)</span><input name="author" placeholder="How should we credit you?" /></label><button className="primary-button" type="submit">Share with your neighbours <ArrowRight size={16} /></button></form></section></div>}

      {toast && <div className="toast-message"><Check size={16} />{toast}</div>}
    </div>
  );
}

function ReviewRatingInput() {
  const [rating, setRating] = useState(5);
  return <><ReviewStars rating={rating} onRate={setRating} /><input type="hidden" name="rating" value={rating} /></>;
}

function SavedCard({ place, saved, onSave, onSelect }: { place: Place; saved: string[]; onSave: (id: string) => void; onSelect: (place: Place) => void }) {
  return <article className="saved-card"><button onClick={() => onSelect(place)}><span className="saved-card-icon" style={{ color: categoryColor(place.category), background: `${categoryColor(place.category)}15` }}><MapPin size={20} /></span><span className="place-category" style={{ color: categoryColor(place.category) }}>{place.category}</span><b>{place.name}</b><span className="place-address">{place.address}</span><span className="place-meta">{place.distance.toFixed(1)} mi <span>·</span> {place.walkMinutes} min walk</span></button><button className={saved.includes(place.id) ? "save-place saved" : "save-place"} onClick={() => onSave(place.id)} aria-label="Unsave place"><Bookmark size={17} fill="currentColor" /></button></article>;
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <article className="feature-card"><span>{icon}</span><h3>{title}</h3><p>{text}</p></article>;
}

function Stat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <article className="admin-stat"><span className="stat-icon">{icon}</span><span className="stat-label">{label}</span><b>{value}</b><small>{detail}</small></article>;
}
