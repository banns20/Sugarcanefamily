# Mavuno Market

Crop-specific marketplaces for Kenyan buyers and sellers, built with Express, EJS, React, Vite, and SQLite.

## Run locally

Requires Node.js 22.5 or newer.

```powershell
npm install
npm run dev
```

Open http://localhost:3000. For a production build, run `npm run build` followed by `npm start`.

## Crop marketplaces

The first visit asks users to choose a crop and a Buyer or Seller mode before they create an account. Supported crops are sugarcane, maize, beans, rice, potatoes, coffee, tea, and avocado. Each crop has its own SQLite database containing its accounts, sessions, and listings. A phone number can have a separate account in each crop market.

Sugarcane retains its standing-crop and land-lease options. Other crops use a crop-specific standing-crop label plus land for lease. Prices are in KSh per acre for standing crops and KSh per acre per year for land leases.

Seller accounts can post multiple listings with a land/crop photo. JPG, PNG, and WebP images up to 6 MB are accepted. Buyer and seller roles can be switched within a crop market. Grower phone numbers are only returned to signed-in users who request contact details.

## Data and deployment

Per-crop databases are stored under `data/crops/`; uploaded photos are stored under `uploads/<crop>/`. Both directories are excluded from version control and should be backed up together. On first upgrade, the previous sugarcane database is backed up into `data/crops/sugarcane.sqlite`; the original file is left untouched. The four starter sugarcane listings are marked as examples, not real offers. Other crop databases start empty.

For HTTPS hosting, set `COOKIE_SECURE=true`, use persistent storage for `data/` and `uploads/`, and back them up regularly.
