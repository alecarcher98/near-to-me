# Near to me

Near to me shows people what's good and closest to them: shops, food, gyms, high-protein and low-calorie eats, things to do, parking and the week's events. It's built to grow area by area, starting with Nuneaton.

## Run locally

```bash
npm install
cp .env.example .env.local   # locally, ADMIN_USERS=Sam:any-password and a 32+ character secret are enough
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The admin portal is at [/admin](http://localhost:3000/admin).

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Unit and API tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run build` / `npm start` | Production build / server |
| `npm run admin:hash -- Sam` | Create a hashed `ADMIN_USERS` entry |

## How it works

**Area and email first.** A first-time visitor sees a welcome screen asking for their area (*Use my location*, or a town or postcode) and email, with an optional first name. If the area is live they go straight into the guide, centred on them. If it isn't, they join the coming-soon list for their place, are told how many others have asked for it, and can explore a live area in the meantime. Either way they're then shown everything the site does. Everyone who signs up is listed under **Sign-ups** in the admin portal. Returning visitors skip the screen (it's remembered in their browser), and *What Near to me does* in the sidebar reopens the tour.

**Personalised to where you are.** Visitors tap *Use my location* (browser geolocation) or enter a postcode. Every place is sorted by straight-line distance from that point, with a walking-time estimate. The location is kept only in that visitor's browser. Postcode lookups go to [postcodes.io](https://postcodes.io). Without a location, the guide starts from the town centre.

**Street map.** The nearby map is a real street map (OpenStreetMap tiles by default) with a pin for every place, coloured and iconned by category, a dashed ring for the chosen distance and a blue dot for the visitor. Drag to move, double-tap or use +/− to zoom; tapping a pin opens the place. The legend under the map filters by category. Set `NEXT_PUBLIC_MAP_TILE_URL` to use a keyed tile provider in production.

**EV charging, what3words and directions.** EV charge points are their own category (with a tile under *What do you need?* and a pin on the map). Any place can carry a what3words address, shown with a **Copy** button only: the site never links to or calls what3words. Older car parks that have what3words written in their details get the same button. Every place has **Apple Maps** and **Google Maps** directions, from the visitor's location when they've shared one; car parks and chargers route to their exact position, everything else to its name and address.

**Explore page sections:** what do you need (food, shops, things to do, gyms, high protein / low cal, pubs, parking, EV charging) → just opened → your favourites nearby → recommended → this week's events → everything nearby (map and list) → visiting? essentials (parking, cash, trains and buses, A&E) → local noticeboard.

**Ranking:** places marked *just opened* come first for three weeks, then *sponsored* places (always labelled), then the nearest.

**Admin portal (`/admin`).** Admins sign in and manage everything without code changes. The main admins (`ADMIN_OWNERS`) also see:

- **Health:** whether the database, postcode lookups, admin sign-in and site settings are working, with timings, the build and region; sign-ups today, this week and over the last 14 days; where people want Near to me next; and each live area's numbers.
- **Sign-ups:** everyone who gave their area and email, live or waiting, with search, a filter, copy emails, CSV download and removal (which also removes their coming-soon entries, for deletion requests).
- **Coming soon** (below).

Every admin can manage:

- **Places:** add, edit or remove places. Mark them as just opened, sponsored, recommended or high protein / low cal. Locations can be filled in from the postcode.
- **Events:** weekly events, or one-off events with a date.
- **Noticeboard:** updates, offers and recommendations shown at the bottom of Explore, with optional pinning and end dates.
- **Reviews:** remove abusive or fake reviews. Reviews go live as soon as they're posted.
- **Business enquiries:** sponsorship, listing and review requests from the *For businesses* page and business sign-ups. Admins can change each enquiry's status, and *Create listing* turns a listing request into a place.

- **Coming soon:** people outside every live area. This includes visitors who sign up with another town or postcode, businesses that enquire from elsewhere, and explore-page visitors whose location isn't covered and who leave their email. They're told the guide is coming soon to their location. Admins see them grouped by location, busiest first, with options to copy emails, open a pre-written "coming soon" email (BCC), download a CSV and mark people as emailed.

**Which places count as covered.** An area lists the council districts it covers (Nuneaton covers *Nuneaton and Bedworth*, so Bedworth is in but Hinckley isn't). Locations are looked up with postcodes.io: a postcode, a town name, or the nearest postcode to a shared GPS position. Business addresses that can't be placed aren't added to the coming-soon list.

## Data and areas

- `data/nuneaton-places.json` and `data/nuneaton-events.json` seed the Nuneaton guide. Places carry latitude and longitude from their postcodes. Twelve that had no usable postcode (including two EV charge points) were placed by street and are flagged `approximateLocation`.
- `lib/areas.ts` registers each area. To add an area, add `data/<area>-places.json` and `data/<area>-events.json` and register them there.
- The first time an area is used, its seed data becomes the starting copy. After that, admin edits, reviews and enquiries are saved to the database.

## Storage

`lib/content-store.ts` picks a backend at start-up:

| Environment | Backend |
| --- | --- |
| `UPSTASH_REDIS_REST_URL`/`TOKEN` (or `KV_REST_API_URL`/`TOKEN`) set | **Upstash Redis.** Use this in production. Every document has a version number, and a write only saves if nobody else wrote in between, so simultaneous saves from different servers never overwrite each other. |
| On Vercel with no database | **Read-only.** The site shows the built-in listings, and every save returns 503 with a clear log message. |
| Anywhere else | **JSON files** in `CONTENT_DIR` (default `.data/`, git-ignored), for local development or a single server with a persistent disk. |

Rate limits use the same Redis database when it's configured, so limits apply across every server instance.

## Security

- **Admin sign-in:** names and scrypt-hashed passwords come from `ADMIN_USERS`; production refuses plain-text passwords. Sign-in attempts are rate-limited per address and per account name, and unknown names take as long to reject as wrong passwords.
- **Admin sessions:** HMAC-signed `__Host-` cookies (`Secure`, `HttpOnly`, `SameSite=Strict`) lasting 12 hours. Changing an admin's password, or removing them from `ADMIN_USERS`, signs them out everywhere. Rotating `ADMIN_SESSION_SECRET` signs out every admin.
- **Cross-site requests:** every write must come from `SITE_URL` (checked against the `Origin` header) and be JSON. Browsers can't send cross-site JSON without a CORS preflight, which the site never grants.
- **Input:** request bodies are capped at 20 KB while being read. Every field is validated and length-limited on the server. Emails are checked strictly (no characters that could add parameters to a `mailto:` link), and links must be `http(s)`. CSV exports neutralise spreadsheet formulas.
- **Abuse:** public forms are rate-limited and have a hidden field that only bots fill in. Reviews can be removed by admins.
- **Headers:** a Content Security Policy (scripts and styles from this site only, connections to this site and postcodes.io, no framing), plus HSTS, `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy and a permissions policy that allows only geolocation.
- **Errors:** API failures are logged on the server and return generic messages. Admin changes are logged with the admin's name.
- **Privacy:** fonts are self-hosted, so no Google requests. A visitor's exact position is never stored; coming-soon sign-ups keep only the nearest postcode area. `/admin` and `/api/` are excluded from search engines.

## Going live checklist

1. **Database:** add Upstash Redis (Vercel → Storage → Marketplace → Upstash), or set `UPSTASH_REDIS_REST_URL`/`TOKEN`.
2. **Admins:** run `npm run admin:hash -- <name>` for each admin, and join the outputs with commas into `ADMIN_USERS`. Put the two main admins' names in `ADMIN_OWNERS` (for example `Alec,Sam`).
3. **Secrets and settings:** set `ADMIN_SESSION_SECRET` (32+ random characters), `SITE_URL`, `NEXT_PUBLIC_OPERATOR_NAME` and `NEXT_PUBLIC_CONTACT_EMAIL`. Set them before building, because the sitemap and robots file are generated at build time.
4. **Legal review:** have someone qualified review `/privacy` and `/terms`. They describe what the code does, but they aren't legal advice.
5. **Deploy and check:** deploy, sign in at `/admin` as a main admin and open **Health**: every check should be green. Then sign up on the welcome screen once with a Nuneaton postcode and once with somewhere else, and check both appear under **Sign-ups**.
6. **Map tiles:** OpenStreetMap's tile server is for light use only. Before real traffic, sign up with a tile provider (MapTiler, Stadia Maps or Thunderforest all have free tiers) and set `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION`, then redeploy.
7. **Optional:** register the domain on the HSTS preload list once HTTPS is settled on every subdomain.

## Known limitations

- **Visitor accounts:** `/account` sign-up and sign-in are a browser-only preview. Sign-in only matches the email saved in that browser; passwords are never stored or sent anywhere. Business sign-ups and out-of-area sign-ups do reach admins. Real visitor accounts need an authentication service.
- **Reviews:** they're published immediately, and admins remove bad ones afterwards. They aren't held for approval.
- **Map:** places are pinned from their postcodes, so a few share a point or sit slightly off; twelve are flagged `approximateLocation`. There's no clustering yet, so very wide distances get busy.
- **Welcome screen:** it's remembered per browser, so someone on a new device is asked again (their sign-up is updated, not duplicated).
- **Inline scripts:** the CSP allows inline scripts because Next.js uses them for static pages. Switching every page to dynamic rendering with nonces would remove that allowance.
