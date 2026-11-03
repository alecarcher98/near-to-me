# Near to me

Near to me is a local discovery guide for visitors, residents and the businesses that welcome them. It includes a nearby map and directory, saved/visited places, community reviews, a business subscription preview, an embeddable guide, QR-code generation and an area admin.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run build` for a production build and `npm run typecheck` to check TypeScript.

## Included LinQR directory

The supplied LinQR guest-directory snapshot is imported into `data/places.json` (130 places across parking, travel, cash access, A&E, laundry, food, pubs, attractions and shopping). Original descriptions, addresses and distances are retained where available.

## Preview scope

This is a browser-only product prototype: business settings, added places, saved lists and reviews are stored in that browser's local storage. The QR code and `/widget` route are functional, and the guide can be embedded with the iframe snippet in Area admin. The supplied source includes distances but no coordinates, so map pins are illustrative, not geocoded. The seed directory describes Nuneaton; changing the area name does not fetch another area's directory. A production multi-tenant launch needs a hosted database, authentication, geocoding/map provider, and billing integration.