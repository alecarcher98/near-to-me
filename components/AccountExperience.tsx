"use client";

import { ArrowLeft, ArrowRight, CalendarDays, Check, Compass, Eye, EyeOff, MapPin, QrCode, Sparkles, Store } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createLocalPlace, spotlightDays, type Place } from "@/lib/directory";

type AccountMode = "signup" | "login";
type AccountRole = "explorer" | "business";

// Only types that match a guide category are listed automatically.
const businessTypes: { label: string; category?: string }[] = [
  { label: "Restaurant, café or takeaway", category: "Food" },
  { label: "Pub or bar", category: "Pubs & bars" },
  { label: "Shop or retail", category: "Shopping" },
  { label: "Attraction or day out", category: "Attractions & days out" },
  { label: "Travel & transport", category: "Travel" },
  { label: "Laundry", category: "Laundry" },
  { label: "Accommodation" },
  { label: "Other local business" },
];

export default function AccountExperience() {
  const [mode, setMode] = useState<AccountMode>("signup");
  const [role, setRole] = useState<AccountRole>("explorer");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");

  function startBusinessSignup() {
    setMode("signup");
    setRole("business");
    setNotice("");
    document.getElementById("account-form-panel")?.scrollIntoView({ behavior: "smooth" });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim();
    const email = text("email").toLowerCase();
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      setNotice("Use at least 8 characters for your password.");
      return;
    }
    if (mode === "signup" && password !== String(form.get("confirmPassword") ?? "")) {
      setNotice("Those passwords don't match. Please check and try again.");
      return;
    }

    try {
      const savedProfile = window.localStorage.getItem("near-to-me:profile");
      if (mode === "login") {
        if (!savedProfile) {
          setNotice("No preview profile found on this device yet. Create an account to get started.");
          return;
        }
        const profile = JSON.parse(savedProfile) as { email?: string; name?: string; role?: AccountRole };
        if (profile.email !== email) {
          setNotice("That email doesn't match the preview profile saved on this device.");
          return;
        }
        window.localStorage.setItem("near-to-me:session", JSON.stringify({ email, signedInAt: new Date().toISOString() }));
        setNotice(`Welcome back${profile.name ? `, ${profile.name.split(" ")[0]}` : ""}! Your preview session is ready.`);
        return;
      }

      const previous = savedProfile ? JSON.parse(savedProfile) as { listedPlaceId?: string } : {};
      let listedPlace: Place | undefined;
      let business: Record<string, string> | undefined;
      if (role === "business") {
        business = {
          businessName: text("businessName"),
          businessType: text("businessType"),
          businessAddress: text("businessAddress"),
          businessPostcode: text("businessPostcode").toUpperCase(),
          businessPhone: text("businessPhone"),
          website: text("website"),
          openingDate: text("openingDate"),
          description: text("description"),
          contactRole: text("contactRole"),
        };
        const category = businessTypes.find((type) => type.label === business?.businessType)?.category;
        if (category) {
          const openedAt = business.openingDate ? new Date(`${business.openingDate}T00:00:00`) : undefined;
          const recentlyOpened = Boolean(openedAt && openedAt.getTime() + spotlightDays * 86_400_000 > Date.now());
          listedPlace = createLocalPlace({
            name: business.businessName,
            category,
            address: `${business.businessAddress}, ${business.businessPostcode}`,
            details: [business.description, business.businessPhone && `Tel ${business.businessPhone}`, business.website].filter(Boolean).join(" · "),
            launchSpotlight: recentlyOpened,
            openedAt,
          });
          const storedPlaces = JSON.parse(window.localStorage.getItem("nearfolk:places") ?? "[]") as Place[];
          window.localStorage.setItem("nearfolk:places", JSON.stringify([...storedPlaces.filter((place) => place.id !== previous.listedPlaceId), listedPlace]));
        }
      }

      const profile = {
        name: text("name"),
        email,
        phone: text("phone"),
        area: text("area"),
        role,
        ...(business ?? { interests: form.getAll("interests").map(String) }),
        listedPlaceId: listedPlace?.id,
        localUpdates: form.get("localUpdates") === "on",
        joinedAt: new Date().toISOString(),
      };
      window.localStorage.setItem("near-to-me:profile", JSON.stringify(profile));
      window.localStorage.setItem("near-to-me:session", JSON.stringify({ email, signedInAt: new Date().toISOString() }));
      const firstName = profile.name.split(" ")[0];
      if (role === "explorer") setNotice(`You're in, ${firstName}! Your neighbour profile is ready.`);
      else if (listedPlace?.launchSpotlight) setNotice(`You're in, ${firstName}! ${listedPlace.name} is listed and featured as just opened for its first three weeks.`);
      else if (listedPlace) setNotice(`You're in, ${firstName}! ${listedPlace.name} is now listed in your local guide.`);
      else setNotice(`You're in, ${firstName}! Your business profile is ready; an area admin can add it to the guide.`);
    } catch (error) {
      console.error("Could not save your local preview profile.", error);
      setNotice("We couldn't save your preview profile. Check your browser storage and try again.");
    }
  }

  return (
    <main className="account-page">
      <header className="account-header">
        <Link className="account-brand" href="/"><span className="account-brand-mark"><MapPin size={19} fill="currentColor" /></span>near to me<span>.</span></Link>
        <Link className="account-back" href="/"><ArrowLeft size={15} /> Back to exploring</Link>
      </header>
      <div className="account-content">
        <section className="account-story">
          <span className="account-kicker"><i /> THE GOOD STUFF STARTS HERE</span>
          <h1>Make a little<br />more room for<br /><em>local.</em></h1>
          <p>Find your new favourite, keep the places you love close, and get to know the people making your neighbourhood.</p>
          <div className="account-story-stamp"><span>NEAR<br />IS A<br /><b>GOOD<br />THING.</b></span></div>
          <div className="account-story-foot"><span>FOR THE CURIOUS, THE COMMUNITY-MINDED & THE PROUDLY LOCAL</span><span>EST. AROUND HERE</span></div>
        </section>
        <section className="account-form-panel" id="account-form-panel">
          <div className="account-form-top"><span>YOUR LOCAL LIFE, A LITTLE CLOSER</span><span>01 — JOIN IN</span></div>
          <div className="account-tabs" role="tablist" aria-label="Account options">
            <button type="button" className={mode === "signup" ? "account-tab active" : "account-tab"} onClick={() => { setMode("signup"); setNotice(""); }}>Create account</button>
            <button type="button" className={mode === "login" ? "account-tab active" : "account-tab"} onClick={() => { setMode("login"); setNotice(""); }}>Sign in</button>
          </div>
          <p className="account-form-eyebrow">{mode === "signup" ? "YOUR NEXT LOCAL FAVOURITE AWAITS" : "GOOD TO HAVE YOU BACK"}</p>
          <h2>{mode === "signup" ? "Come on in." : "Welcome back."}</h2>
          <p className="account-form-intro">{mode === "signup" ? "A few details, then your neighbourhood is yours." : "Pick up where your local life left off."}</p>

          {mode === "signup" && (
            <div className="role-picker" aria-label="Choose account type">
              <button type="button" className={role === "explorer" ? "role-option selected" : "role-option"} onClick={() => setRole("explorer")}><Compass size={17} /><span><b>I’m here to explore</b><small>Save places & share local tips</small></span>{role === "explorer" && <Check size={15} />}</button>
              <button type="button" className={role === "business" ? "role-option selected" : "role-option"} onClick={() => setRole("business")}><Store size={17} /><span><b>I’m a local business</b><small>Welcome people to your area</small></span>{role === "business" && <Check size={15} />}</button>
            </div>
          )}

          <form className="account-form" onSubmit={submit}>
            {mode === "signup" && <label className="account-field">{role === "business" ? "YOUR NAME (ACCOUNT CONTACT)" : "YOUR NAME"}<input name="name" autoComplete="name" required placeholder="What should we call you?" /></label>}
            <label className="account-field">EMAIL ADDRESS<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
            {mode === "signup" && <label className="account-field">PHONE <span className="account-optional">OPTIONAL</span><input name="phone" type="tel" autoComplete="tel" placeholder="07700 900000" /></label>}
            {mode === "signup" && <label className="account-field">{role === "business" ? "AREA YOU SERVE" : "YOUR LOCAL AREA"}<span className="account-input-icon"><MapPin size={15} /><input name="area" required placeholder="Town or postcode" /></span></label>}
            <label className={mode === "login" ? "account-field wide" : "account-field"}>PASSWORD<span className="password-wrap"><input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
            {mode === "signup" && <label className="account-field">CONFIRM PASSWORD<input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required placeholder="Type it once more" /></label>}

            {mode === "signup" && role === "business" && (
              <div className="business-signup-fields">
                <p className="account-subhead"><Store size={14} /> ABOUT YOUR BUSINESS</p>
                <label className="account-field">BUSINESS NAME<input name="businessName" required placeholder="The name above your door" /></label>
                <label className="account-field">WHAT KIND OF BUSINESS?<select name="businessType" required defaultValue=""><option value="" disabled>Choose a category</option>{businessTypes.map((type) => <option key={type.label}>{type.label}</option>)}</select></label>
                <label className="account-field wide">BUSINESS ADDRESS<input name="businessAddress" autoComplete="street-address" required placeholder="Number and street, town" /></label>
                <label className="account-field">POSTCODE<input name="businessPostcode" autoComplete="postal-code" required placeholder="CV11 4DZ" /></label>
                <label className="account-field">BUSINESS PHONE<input name="businessPhone" type="tel" required placeholder="024 7600 0000" /></label>
                <label className="account-field">WEBSITE OR SOCIAL <span className="account-optional">OPTIONAL</span><input name="website" placeholder="yourbusiness.co.uk" /></label>
                <label className="account-field">YOUR ROLE<select name="contactRole" required defaultValue=""><option value="" disabled>Choose one</option><option>Owner</option><option>Manager</option><option>Marketing / social</option><option>Other</option></select></label>
                <label className="account-field wide">OPENING DATE <span className="account-optional">NEW? WE’LL FEATURE YOU</span><span className="account-input-icon"><CalendarDays size={15} /><input name="openingDate" type="date" /></span></label>
                <label className="account-field wide">TELL NEIGHBOURS ABOUT YOU<textarea name="description" required rows={3} maxLength={300} placeholder="Opening hours, what you serve or sell, what makes you worth the walk…" /></label>
                <p className="account-spotlight-note"><Sparkles size={13} /> Opened in the last {spotlightDays / 7} weeks? You’ll appear at the top of the guide as <b>Just opened</b> for your first three weeks.</p>
              </div>
            )}
            {mode === "signup" && role === "explorer" && <fieldset className="interest-fieldset"><legend>WHAT DO YOU LIKE TO FIND? <span>OPTIONAL</span></legend><label><input type="checkbox" name="interests" value="Food & drink" /> Food & drink</label><label><input type="checkbox" name="interests" value="Pubs & nights out" /> Pubs & nights out</label><label><input type="checkbox" name="interests" value="Independent shops" /> Independent shops</label><label><input type="checkbox" name="interests" value="Events & culture" /> Events & culture</label><label><input type="checkbox" name="interests" value="Things to do" /> Things to do</label></fieldset>}
            {mode === "signup" && <label className="account-check"><input type="checkbox" name="localUpdates" /> {role === "business" ? "Send me tips for reaching more local customers." : "Send me a weekly round-up of new openings and events."}</label>}
            {mode === "signup" && <label className="account-check"><input type="checkbox" name="terms" required /> I agree to the <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</label>}
            {mode === "login" && <button className="forgot-password" type="button" onClick={() => setNotice("Password reset requires a verified email service; it isn’t enabled in this local preview.")}>Forgot password?</button>}
            <button className="account-submit" type="submit">{mode === "signup" ? role === "business" ? "Create your business account" : "Create my free account" : "Sign in to Near to me"} <ArrowRight size={16} /></button>
          </form>
          {notice && <p className={notice.startsWith("We couldn't") || notice.startsWith("Those") || notice.startsWith("Use at") ? "account-notice error" : "account-notice"} role="status">{notice}</p>}
          {mode === "login" && <p className="account-legal">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy.</a></p>}
          <p className="account-preview-note">Preview mode: profile details stay in this browser. Passwords are never saved. Live sign-in, email verification and password recovery need a production authentication service.</p>
        </section>
      </div>

      <section className="account-business" aria-labelledby="account-business-title">
        <div className="account-business-copy">
          <span className="account-kicker"><i /> FOR LOCAL BUSINESSES</span>
          <h2 id="account-business-title">Are you a <em>business?</em></h2>
          <p>Put your door on the map for the people right around it. Free to list, with a first-look boost when you’ve just opened.</p>
          <button type="button" className="account-business-cta" onClick={startBusinessSignup}>Set up your business account <ArrowRight size={16} /></button>
        </div>
        <ul className="account-business-perks">
          <li><Sparkles size={18} /><span><b>Just-opened spotlight</b><small>New openings sit at the top of the guide for their first three weeks.</small></span></li>
          <li><CalendarDays size={18} /><span><b>Share what’s on</b><small>Quiz nights, live music, offers — seen by locals planning their week.</small></span></li>
          <li><QrCode size={18} /><span><b>Your own guide & QR</b><small>Give guests a local guide from your website or front desk.</small></span></li>
        </ul>
      </section>
    </main>
  );
}
