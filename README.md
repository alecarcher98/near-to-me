# Near to me

Near to me is a local discovery guide for visitors, residents and the businesses that welcome them. It includes a nearby map and directory, saved/visited places, community reviews, a weekly events guide, a sign-up/sign-in experience, a business subscription preview, an embeddable guide, QR-code generation and an area admin.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run build` for a production build and `npm run typecheck` to check TypeScript.

## Included LinQR directory

The supplied LinQR guest-directory snapshot is imported into `data/places.json` (130 places across parking, travel, cash access, A&E, laundry, food, pubs, attractions and shopping). `data/events.json` holds seven weekly events plus two dated one-offs (the 31 Oct Halloween party and 30 Oct bingo); dated events only appear in the week they happen. Newly opened places (Alanya Turkish Restaurant and The Jail House Pub & Bistro) get a three-week "Just opened" spotlight: a section at the top of Explore and first position in the directory. Businesses that sign up with a recent opening date get the same spotlight automatically.

## Preview scope

This is a browser-only product prototype: business settings, added places, saved lists, reviews and preview account profiles are stored in that browser's local storage. Passwords are never stored. The `/account` forms demonstrate the sign-up and sign-in experience but do not authenticate users; live authentication, verification, password recovery and account security need a production authentication service. The QR code and `/widget` route are functional, and the guide can be embedded with the iframe snippet in Area admin. The supplied source includes distances but no coordinates, so map pins are illustrative, not geocoded. The seed directory describes Nuneaton; changing the area name does not fetch another area's directory. A production multi-tenant launch also needs a hosted database, a geocoding/map provider, and billing integration.