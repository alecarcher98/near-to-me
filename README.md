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

**Personalised to where you are.** Visitors tap *Use my location* (browser geolocation) or enter a postcode. Every place is sorted by straight-line distance from that point, with a walking-time estimate. The location is kept only in that visitor's browser. Postcode lookups go to [postcodes.io](https://postcodes.io). Without a location, the guide starts from the town centre.

**Explore page sections:** what do you need (shops, things to do, gyms, high protein / low cal, pubs, parking) → just opened → your favourites nearby → recommended → this week's events → everything nearby (map and list) → visiting? essentials (parking, cash, trains and buses, A&E) → local noticeboard.

**Ranking:** places marked *just opened* come first for three weeks, then *sponsored* places (always labelled), then the nearest.

**Admin portal (`/admin`).** Admins sign in and manage everything without code changes:

- **Places:** add, edit or remove places. Mark them as just opened, sponsored, recommended or high protein / low cal. Locations can be filled in from the postcode.
- **Events:** weekly events, or one-off events with a date.
- **Noticeboard:** updates, offers and recommendations shown at the bottom of Explore, with optional pinning and end dates.
- **Reviews:** remove abusive or fake reviews. Reviews go live as soon as they're posted.
- **Business enquiries:** sponsorship, listing and review requests from the *For businesses* page and business sign-ups. Admins can change each enquiry's status, and *Create listing* turns a listing request into a place.

- **Coming soon:** people outside every live area. This includes visitors who sign up with another town or postcode, businesses that enquire from elsewhere, and explore-page visitors whose location isn't covered and who leave their email. They're told the guide is coming soon to their location. Admins see them grouped by location, busiest first, with options to copy emails, open a pre-written "coming soon" email (BCC), download a CSV and mark people as emailed.

**Which places count as covered.** An area lists the council districts it covers (Nuneaton covers *Nuneaton and Bedworth*, so Bedworth is in but Hinckley isn't). Locations are looked up with postcodes.io: a postcode, a town name, or the nearest postcode to a shared GPS position. Business addresses that can't be placed aren't added to the coming-soon list.

## Data and areas

- `data/nuneaton-places.json` and `data/nuneaton-events.json` seed the Nuneaton guide. Places carry latitude and longitude from their postcodes. Eight that had no usable postcode were placed by street and are flagged `approximateLocation`.
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
2. **Admins:** run `npm run admin:hash -- <name>` for each admin, and join the outputs with commas into `ADMIN_USERS`.
3. **Secrets and settings:** set `ADMIN_SESSION_SECRET` (32+ random characters), `SITE_URL`, `NEXT_PUBLIC_OPERATOR_NAME` and `NEXT_PUBLIC_CONTACT_EMAIL`. Set them before building, because the sitemap and robots file are generated at build time.
4. **Legal review:** have someone qualified review `/privacy` and `/terms`. They describe what the code does, but they aren't legal advice.
5. **Deploy and check:** deploy, sign in at `/admin`, and post a test noticeboard update to confirm saving works.
6. **Optional:** register the domain on the HSTS preload list once HTTPS is settled on every subdomain.

## Known limitations

- **Visitor accounts:** `/account` sign-up and sign-in are a browser-only preview. Sign-in only matches the email saved in that browser; passwords are never stored or sent anywhere. Business sign-ups and out-of-area sign-ups do reach admins. Real visitor accounts need an authentication service.
- **Reviews:** they're published immediately, and admins remove bad ones afterwards. They aren't held for approval.
- **Map:** the nearby map is a distance view centred on the visitor (rings at half and full radius), not a street map.
- **Inline scripts:** the CSP allows inline scripts because Next.js uses them for static pages. Switching every page to dynamic rendering with nonces would remove that allowance.
