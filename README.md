# Near to me

Near to me shows people what's good and closest to them: shops, food, gyms, high-protein and low-calorie eats, things to do, parking and the week's events. It's built to grow area by area, starting with Nuneaton.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in ADMIN_USERS and ADMIN_SESSION_SECRET
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The admin portal is at [/admin](http://localhost:3000/admin).

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Unit and API tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run build` / `npm start` | Production build / server |

## How it works

**Personalised to where you are.** Visitors tap *Use my location* (browser geolocation) or enter a postcode. Every place is sorted by straight-line distance from that point, with a walking-time estimate. The location is kept only in that visitor's browser. Postcode lookups go to [postcodes.io](https://postcodes.io). Without a location, the guide starts from the town centre.

**Explore page sections:** what do you need (shops, things to do, gyms, high protein / low cal, pubs, parking) → just opened → your favourites nearby → recommended → this week's events → everything nearby (map and list) → visiting? essentials (parking, cash, trains and buses, A&E) → local noticeboard.

**Ranking:** places marked *just opened* come first for three weeks, then *sponsored* places (always labelled), then the nearest.

**Admin portal (`/admin`).** Admins sign in and manage everything without code changes:

- **Places:** add, edit or remove places. Mark them as just opened, sponsored, recommended or high protein / low cal. Locations can be filled in from the postcode.
- **Events:** weekly events, or one-off events with a date.
- **Noticeboard:** updates, offers and recommendations shown at the bottom of Explore, with optional pinning and end dates.
- **Reviews:** remove abusive or fake reviews. Reviews go live as soon as they're posted.
- **Business enquiries:** sponsorship, listing and review requests from the *For businesses* page and business sign-ups. Admins can change each enquiry's status, and *Create listing* turns a listing request into a place.

Admin accounts come from `ADMIN_USERS` (see `.env.example`). Sessions are signed, HTTP-only, same-site cookies that last 12 hours. Admin changes and public form posts are rejected unless they come from the site itself.

## Data and areas

- `data/nuneaton-places.json` and `data/nuneaton-events.json` seed the Nuneaton guide. Places carry latitude and longitude from their postcodes. Eight that had no usable postcode were placed by street and are flagged `approximateLocation`.
- `lib/areas.ts` registers each area. To add an area, add `data/<area>-places.json` and `data/<area>-events.json` and register them there.
- The first time an area is used, its seed data is copied into `CONTENT_DIR` (default `.data/`, which is git-ignored). After that, admin edits, reviews and enquiries are saved there.

## Before going live

- **Storage:** content is saved as one JSON file per area on the server's disk. This works on a single long-running Node server, such as a VPS, Render or Railway with a persistent disk. It **won't persist on serverless hosts** like Vercel. For those, or to run more than one instance, replace `lib/content-store.ts` with a database.
- **Rate limits:** public forms are rate-limited in memory, per server instance.
- **Visitor accounts:** `/account` sign-up and sign-in are still a browser-only preview. Business sign-ups do reach admins as enquiries. Real visitor accounts need an authentication service.
- **Map:** the nearby map is a distance view centred on the visitor (rings at half and full radius), not a street map.
