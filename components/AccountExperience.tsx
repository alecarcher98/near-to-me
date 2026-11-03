"use client";

import { ArrowLeft, ArrowRight, Check, Compass, Eye, EyeOff, MapPin, Store } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

type AccountMode = "signup" | "login";
type AccountRole = "explorer" | "business";

export default function AccountExperience() {
  const [mode, setMode] = useState<AccountMode>("signup");
  const [role, setRole] = useState<AccountRole>("explorer");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      setNotice("Use at least 8 characters for your password.");
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

      const profile = {
        name: String(form.get("name") ?? "").trim(),
        email,
        area: String(form.get("area") ?? "").trim(),
        role,
        ...(role === "business" ? {
          businessName: String(form.get("businessName") ?? "").trim(),
          businessType: String(form.get("businessType") ?? "").trim(),
        } : {
          interests: form.getAll("interests").map(String),
        }),
        joinedAt: new Date().toISOString(),
      };
      window.localStorage.setItem("near-to-me:profile", JSON.stringify(profile));
      window.localStorage.setItem("near-to-me:session", JSON.stringify({ email, signedInAt: new Date().toISOString() }));
      setNotice(`You're in, ${profile.name.split(" ")[0]}! Your ${role === "business" ? "business" : "neighbour"} profile is ready.`);
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
        <section className="account-form-panel">
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
            {mode === "signup" && <label className="account-field">YOUR NAME<input name="name" autoComplete="name" required placeholder="What should we call you?" /></label>}
            <label className="account-field">EMAIL ADDRESS<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
            <label className="account-field">PASSWORD<span className="password-wrap"><input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
            {mode === "signup" && <label className="account-field">{role === "business" ? "YOUR BUSINESS AREA" : "YOUR LOCAL AREA"}<span className="account-input-icon"><MapPin size={15} /><input name="area" required placeholder="Town, city or postcode" /></span></label>}
            {mode === "signup" && role === "business" && <div className="business-signup-fields"><label className="account-field">BUSINESS NAME<input name="businessName" required placeholder="The name above your door" /></label><label className="account-field">WHAT KIND OF BUSINESS?<select name="businessType" required defaultValue=""><option value="" disabled>Choose a category</option><option>Accommodation</option><option>Food & drink</option><option>Retail</option><option>Attractions & experiences</option><option>Other local business</option></select></label></div>}
            {mode === "signup" && role === "explorer" && <fieldset className="interest-fieldset"><legend>WHAT DO YOU LIKE TO FIND? <span>OPTIONAL</span></legend><label><input type="checkbox" name="interests" value="Food & drink" /> Food & drink</label><label><input type="checkbox" name="interests" value="Independent shops" /> Independent shops</label><label><input type="checkbox" name="interests" value="Events & culture" /> Events & culture</label><label><input type="checkbox" name="interests" value="Things to do" /> Things to do</label></fieldset>}
            {mode === "login" && <button className="forgot-password" type="button" onClick={() => setNotice("Password reset requires a verified email service; it isn’t enabled in this local preview.")}>Forgot password?</button>}
            <button className="account-submit" type="submit">{mode === "signup" ? role === "business" ? "Create your business account" : "Create my free account" : "Sign in to Near to me"} <ArrowRight size={16} /></button>
          </form>
          {notice && <p className={notice.startsWith("We couldn't") ? "account-notice error" : "account-notice"} role="status">{notice}</p>}
          <p className="account-legal">By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy.</a></p>
          <div className="business-callout"><span className="business-callout-icon"><Store size={17} /></span><span><b>Are you a business?</b><small>Get discovered by the people right around you.</small></span><button type="button" onClick={() => { setMode("signup"); setRole("business"); setNotice(""); }}>Set up your local guide <ArrowRight size={15} /></button></div>
          <p className="account-preview-note">Preview mode: profile details stay in this browser. Passwords are never saved. Live sign-in, email verification and password recovery need a production authentication service.</p>
        </section>
      </div>
    </main>
  );
}
