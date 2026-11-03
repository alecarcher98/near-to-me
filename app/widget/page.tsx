"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import placesData from "@/data/places.json";

type Place = (typeof placesData)[number];

export default function WidgetPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Everything");
  const [places, setPlaces] = useState(placesData as Place[]);
  const [baseLocation, setBaseLocation] = useState("Nuneaton, UK");
  const [radius, setRadius] = useState(5);

  useEffect(() => {
    try {
      const savedPlaces = window.localStorage.getItem("nearfolk:places");
      const savedLocation = window.localStorage.getItem("nearfolk:baseLocation");
      const savedRadius = window.localStorage.getItem("nearfolk:radius");
      if (savedPlaces) setPlaces(JSON.parse(savedPlaces) as Place[]);
      if (savedLocation) setBaseLocation(JSON.parse(savedLocation) as string);
      if (savedRadius) setRadius(JSON.parse(savedRadius) as number);
    } catch (error) {
      console.error("Could not load the saved local guide for this widget.", error);
    }
  }, []);

  const categories = ["Everything", ...Array.from(new Set(places.map((place) => place.category)))];
  const filtered = useMemo(
    () =>
      places
        .filter((place) => category === "Everything" || place.category === category)
        .filter((place) => `${place.name} ${place.address}`.toLowerCase().includes(query.toLowerCase()))
        .filter((place) => place.distance <= radius)
        .slice(0, 8),
    [category, places, query, radius],
  );

  return (
    <main className="widget-page">
      <header className="widget-header">
        <a className="brand-lockup" href="/">
          <span className="brand-mark"><MapPin size={19} fill="currentColor" /></span>
          <span>near to me<span className="brand-period">.</span></span>
        </a>
        <span className="widget-powered">LOCAL GUIDE</span>
      </header>
      <section className="widget-intro">
        <div className="widget-intro-copy">
          <p className="eyebrow">THE GOOD THINGS, CLOSE BY</p>
          <h1>Good things are<br />closer than you think.</h1>
          <p>Explore independent favourites, useful stops and little local gems around <b>{baseLocation.split(",")[0]}.</b></p>
        </div>
        <div className="widget-hero-art" aria-hidden="true">
          <div className="widget-art-orbit" />
          <div className="widget-art-pin"><MapPin size={28} fill="currentColor" /></div>
          <span className="widget-art-place place-a">A GOOD LITTLE FIND</span>
          <span className="widget-art-place place-b">JUST AROUND HERE</span>
          <span className="widget-art-town">LOCAL<br />LOOKS GOOD<br /><b>ON YOU.</b></span>
        </div>
      </section>
      <div className="widget-controls">
        <label className="widget-search">
          <MapPin size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search nearby places" />
        </label>
        <div className="widget-categories">
          {categories.map((item) => (
            <button key={item} className={category === item ? "chip active" : "chip"} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>
      </div>
      <div className="widget-list">
        {filtered.map((place) => (
          <article className="widget-place" key={place.id}>
            <span className="widget-category-icon">{place.category === "Food" ? "✳" : place.category === "Shopping" ? "◇" : "⌖"}</span>
            <div className="widget-place-copy">
              <span className="widget-category-label">{place.category}</span>
              <h2>{place.name}</h2>
              <p>{place.address || place.details.slice(0, 100)}</p>
              <span className="widget-distance">{place.distance.toFixed(1)} mi <span>·</span> {place.walkMinutes} min walk</span>
            </div>
            <a className="widget-arrow" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address}`)}`} target="_blank" rel="noreferrer" aria-label={`Directions to ${place.name}`}><ArrowUpRight size={17} /></a>
          </article>
        ))}
        {filtered.length === 0 && <p className="empty-note">No nearby places match that search.</p>}
      </div>
      <footer className="widget-footer">
        <span>Made for curious neighbours</span>
        <span className="powered-by">LOCAL GUIDE BY <b>NEAR TO ME</b></span>
      </footer>
    </main>
  );
}
