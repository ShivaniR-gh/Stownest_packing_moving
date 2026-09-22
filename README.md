# StowNest — Vehicle & Moving Cost Calculator

Static HTML/CSS/JS app (GitHub Pages friendly). **All data lives in one Google Sheet.**
The web app is read-only: it fetches the sheet on every load and has no add / edit / delete screens.
There is no business data in the code and nothing is stored in the browser except the signed-in session
and an unsent quote draft.

```
Browser (view + quote)  ──GET?token=…──►  Apps Script web app  ──reads──►  Google Sheet
                        ──POST login ──►  (apps-script/Code.gs)
```

## Sheet tabs

Row 1 = headers (case-insensitive), data from row 2. `active` = `yes` / `no`.

| Tab | Columns |
| --- | --- |
| Settings | `key`, `value` — companyName, companyTagline, currencySymbol, perCftRate, ratePerKm, minimumCharge, sessionMinutes; for the quote PDF (all optional): companyAddress, companyPhone, companyEmail, companyWebsite, companyGstin, quoteValidityDays, quoteTerms (lines separated by `|`) |
| Users | `username`, `name`, `role` (admin / employee), `active`, `passwordHash` |
| Vehicles | `id`, `name`, `maxCft`, `active` |
| Items | `id`, `name`, `cft`, `unit`, `active` |
| Cities | `city`, `aliases` (comma separated, e.g. `Bengaluru, BLR`) |
| Lanes | `from`, `to`, `km`, `delivery`, then per vehicle: `<Vehicle name> dedicated`, `<Vehicle name> sharing` |
| Services | `id`, `name`, `pricingType` (fixed / per_item / per_box / per_km / per_hour / percentage), `rate`, `active` |

`sheet-setup/*.csv` contains the data that used to be hardcoded in `data/defaults.js`.
Import each file once (File → Import → Upload → *Replace current sheet* on the matching tab), then delete the folder if you like.

## Setup

1. Open the Google Sheet → Extensions → Apps Script → paste `apps-script/Code.gs` → Save.
2. Reload the sheet. Use the new **StowNest** menu → *Create missing tabs*.
3. Import the CSVs from `sheet-setup/` into their tabs (skip tabs that already hold live data).
4. **StowNest → Set user password…** — the first user created becomes `admin`.
5. Apps Script → Deploy → New deployment → Web app → Execute as **Me**, access **Anyone** → copy the `/exec` URL.
6. Paste it into `js/config.js → sheetApiUrl`, commit, and publish on GitHub Pages.

After editing `Code.gs`, use Deploy → Manage deployments → Edit → *New version* so the same URL serves the new code.

## Day-to-day

- Change a price, CFT, vehicle, city or service **in the sheet**, then click **↻ Refresh from sheet** in the app (or reload).
- Add a vehicle: add a row in Vehicles, then add `<name> dedicated` / `<name> sharing` columns in Lanes.
- Block a user: set `active` to `no` — their next request is rejected.
- **StowNest → Sign everyone out** rotates the token secret.

## Security notes

- Passwords are stored only as SHA-256 hashes (`username:password`); the web app never sees the hashes.
- Every data request carries an HMAC-signed, expiring token issued by Apps Script; the Users tab is re-checked on each request.
- Anyone with edit access to the sheet can change prices and users — share the sheet accordingly.

## Project layout

```
index.html
apps-script/Code.gs        read-only sheet API + login + sheet menu
sheet-setup/*.csv          one-time import of the old hardcoded data
js/config.js               Apps Script URL + sheet link (no data)
js/services/api.js         fetch wrapper for the Apps Script
js/services/auth.js        session (sessionStorage)
js/services/data.js        in-memory, read-only copy of the sheet
js/utils/calculations.js   CFT, vehicle pick, pricing engine
js/utils/quotePdf.js       A4 quote PDF (jsPDF, bundled in assets/vendor, Source Sans in assets/fonts)
js/pages/*.js              calculator + view-only master pages
```
