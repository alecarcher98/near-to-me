"use client";

import { ArrowLeft, ArrowRight, CalendarDays, Check, Compass, Eye, EyeOff, MapPin, Megaphone, Sparkles, Star, Store } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

type AccountMode = "signup" | "login";
type AccountRole = "explorer" | "business";

const businessTypes = ["Restaurant, café or takeaway", "Pub or bar", "Shop or retail", "Gym or fitness", "Attraction or day out", "Travel & transport", "Laundry", "Accommodation", "Other local business"];

export default function AccountExperience() {
  const [mode, setMode] = useState<AccountMode>("signup");
  const [role, setRole] = useState<AccountRole>("explorer");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);

  function startBusinessSignup() {
    setMode("signup");
    setRole("business");
    setNotice("");
    document.getElementById("account-form-panel")?.scrollIntoView({ behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
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

      let business: Record<string, string> | undefined;
      let comingSoon = "";
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
        // Listings go to the admin queue; the guide team checks details before they appear.
        setSending(true);
        try {
          const response = await fetch("/api/enquiries", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              kind: "listing",
              businessName: business.businessName,
              contactName: text("name"),
              email,
              phone: business.businessPhone,
              businessType: business.businessType,
              address: `${business.businessAddress}, ${business.businessPostcode}`,
              openingDate: business.openingDate,
              website: business.website,
              message: `${business.description}\n\nContact role: ${business.contactRole}`,
              contactTime: form.get("contactTime"),
              fromSignup: true,
            }),
          });
          const result = await response.json().catch(() => ({})) as { error?: string; comingSoon?: string };
          if (!response.ok) {
            setNotice(`We couldn't send your listing: ${result.error ?? "please try again."}`);
            return;
          }
          comingSoon = result.comingSoon ?? "";
        } finally {
          setSending(false);
        }
      }

      if (role === "explorer") {
        // Tells admins where people want Near to me next; the account itself still saves if this fails.
        setSending(true);
        try {
          const response = await fetch("/api/waitlist", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, name: text("name"), location: text("area"), source: "signup", role: "explorer", contactTime: form.get("contactTime") }),
          });
          const result = await response.json().catch(() => ({})) as { status?: string; placeName?: string };
          if (response.ok && result.status !== "active") comingSoon = result.placeName ?? text("area");
        } catch (error) {
          console.error("Could not check whether Near to me covers this area yet.", error);
        } finally {
          setSending(false);
        }
      }

      const profile = {
        name: text("name"),
        email,
        phone: text("phone"),
        area: text("area"),
        role,
        ...(business ?? { interests: form.getAll("interests").map(String) }),
        localUpdates: form.get("localUpdates") === "on",
        joinedAt: new Date().toISOString(),
      };
      window.localStorage.setItem("near-to-me:profile", JSON.stringify(profile));
      window.localStorage.setItem("near-to-me:session", JSON.stringify({ email, signedInAt: new Date().toISOString() }));
      const firstName = profile.name.split(" ")[0];
      if (comingSoon) setNotice(`You're in, ${firstName}! Near to me isn't in ${comingSoon} just yet, but it's coming soon. We'll email you at ${email} as soon as it's available there.`);
      else if (role === "explorer") setNotice(`You're in, ${firstName}! Your neighbour profile is ready.`);
      else setNotice(`You're in, ${firstName}! We've sent ${business?.businessName} to the guide team. Once they've checked the details it'll appear nearby${business?.openingDate ? ", with a just-opened spotlight if you're new" : ""}.`);
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
                <label className="account-field">WHAT KIND OF BUSINESS?<select name="businessType" required defaultValue=""><option value="" disabled>Choose a category</option>{businessTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label className="account-field wide">BUSINESS ADDRESS<input name="businessAddress" autoComplete="street-address" required placeholder="Number and street, town" /></label>
                <label className="account-field">POSTCODE<input name="businessPostcode" autoComplete="postal-code" required placeholder="CV11 4DZ" /></label>
                <label className="account-field">BUSINESS PHONE<input name="businessPhone" type="tel" required placeholder="024 7600 0000" /></label>
                <label className="account-field">WEBSITE OR SOCIAL <span className="account-optional">OPTIONAL</span><input name="website" placeholder="yourbusiness.co.uk" /></label>
                <label className="account-field">YOUR ROLE<select name="contactRole" required defaultValue=""><option value="" disabled>Choose one</option><option>Owner</option><option>Manager</option><option>Marketing / social</option><option>Other</option></select></label>
                <label className="account-field wide">OPENING DATE <span className="account-optional">NEW? WE’LL FEATURE YOU</span><span className="account-input-icon"><CalendarDays size={15} /><input name="openingDate" type="date" /></span></label>
                <label className="account-field wide">TELL NEIGHBOURS ABOUT YOU<textarea name="description" required rows={3} maxLength={300} placeholder="Opening hours, what you serve or sell, what makes you worth the walk…" /></label>
                <p className="account-spotlight-note"><Sparkles size={13} /> Opened in the last three weeks? You’ll appear at the top of the guide as <b>Just opened</b> for your first three weeks.</p>
              </div>
            )}
            {mode === "signup" && role === "explorer" && <fieldset className="interest-fieldset"><legend>WHAT DO YOU LIKE TO FIND? <span>OPTIONAL</span></legend><label><input type="checkbox" name="interests" value="Food & drink" /> Food & drink</label><label><input type="checkbox" name="interests" value="Pubs & nights out" /> Pubs & nights out</label><label><input type="checkbox" name="interests" value="Independent shops" /> Independent shops</label><label><input type="checkbox" name="interests" value="Events & culture" /> Events & culture</label><label><input type="checkbox" name="interests" value="Things to do" /> Things to do</label></fieldset>}
            {mode === "signup" && <label className="account-check"><input type="checkbox" name="localUpdates" /> {role === "business" ? "Send me tips for reaching more local customers." : "Send me a weekly round-up of new openings and events."}</label>}
            {mode === "signup" && <label className="account-check"><input type="checkbox" name="terms" required /> I agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</label>}
            {mode === "login" && <button className="forgot-password" type="button" onClick={() => setNotice("Password reset requires a verified email service; it isn’t enabled in this local preview.")}>Forgot password?</button>}
            <input className="form-trap" name="contactTime" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <button className="account-submit" type="submit" disabled={sending}>{mode === "signup" ? role === "business" ? "Create your business account" : "Create my free account" : "Sign in to Near to me"} <ArrowRight size={16} /></button>
          </form>
          {notice && <p className={notice.startsWith("We couldn't") || notice.startsWith("Something") || notice.startsWith("Those") || notice.startsWith("Use at") ? "account-notice error" : "account-notice"} role="status">{notice}</p>}
          {mode === "login" && <p className="account-legal">By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy.</a></p>}
          <p className="account-preview-note">Preview mode: profile details stay in this browser. Passwords are never saved. Live sign-in, email verification and password recovery need a production authentication service.</p>
        </section>
      </div>

      <section className="account-business" aria-labelledby="account-business-title">
        <div className="account-business-copy">
          <span className="account-kicker"><i /> FOR LOCAL BUSINESSES</span>
          <h2 id="account-business-title">Are you a <em>business?</em></h2>
          <p>Put your door on the map for the people right around it. Free to list, with a first-look boost when you’ve just opened. Want to be featured higher? Ask the guide team about sponsorship.</p>
          <button type="button" className="account-business-cta" onClick={startBusinessSignup}>Set up your business account <ArrowRight size={16} /></button>
        </div>
        <ul className="account-business-perks">
          <li><Sparkles size={18} /><span><b>Just-opened spotlight</b><small>New openings sit at the top of the guide for their first three weeks.</small></span></li>
          <li><CalendarDays size={18} /><span><b>Share what’s on</b><small>Quiz nights, live music, offers — seen by locals planning their week.</small></span></li>
          <li><Star size={18} /><span><b>Collect reviews</b><small>Locals review you straight from your listing.</small></span></li>
          <li><Megaphone size={18} /><span><b>Get sponsored</b><small>Appear higher in nearby results, clearly labelled as sponsored.</small></span></li>
        </ul>
      </section>
    </main>
  );
}
