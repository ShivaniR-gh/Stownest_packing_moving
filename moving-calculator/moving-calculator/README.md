# GreenShift — Vehicle & Moving Cost Calculator

Internal web application for a storage / moving company. Employees create an order, pick items from a configurable item master, and the app calculates cubic feet (CFT), recommends a vehicle, and estimates the moving rate from configurable pricing rules.

No backend is required. Masters and orders are stored in the browser through a service layer so a REST API can replace `localStorage` later without rewriting the UI.

## Open the app

This is a static site (HTML, CSS, JavaScript). No build step.

```bash
# from this folder — any static server works
npx --yes serve .
```

Then open the URL printed in the terminal (typically http://localhost:3000).

You can also open `index.html` directly in a browser. Searchable dropdowns and localStorage work either way.

## GitHub Pages

1. Create a repository and push this folder as the repo root (or `/docs`).
2. In the repository: **Settings → Pages → Deploy from a branch** → `main` / root (or `/docs`).
3. The app uses hash routing (`#/calculator`, `#/orders`, …), so it works on GitHub Pages without a custom 404 rewrite.

There are no secrets and no environment files to configure.

## What employees can do

| Page | Purpose |
| --- | --- |
| Dashboard | Counts, recent orders, shortcuts |
| Order Calculator | Customer form, item rows, live CFT, vehicle recommendation, rate breakdown, save |
| Orders | Search, filter, view, edit, duplicate, cancel, delete |
| Item Master | Add / edit / deactivate items and CFT values |
| Vehicle Master | Add / edit vehicle names, max CFT, floor price, extra CFT rate |
| Rate Configuration | Vehicle rates, distance rules, additional services |
| Settings | Company name, currency, JSON backup / restore, factory reset |

## How calculation works

All numbers come from master data. Nothing important is hardcoded in the calculator screen.

**Volume**

- Item CFT = quantity × CFT per item (from Item Master)
- Order CFT = sum of item CFT

**Vehicle**

- Smallest *active* vehicle whose `maximum CFT ≥ order CFT`
- If the load is larger than every vehicle → “Multiple Vehicles Required”

**Amount (intercity lanes from the sheet)**

```
Vehicle = smallest size whose max CFT >= order CFT
          and that has a price on the selected lane

Dedicated total = lane dedicated price for that vehicle
                + selected services

Sharing total   = (order CFT / vehicle CFT) × lane sharing price
                + selected services
```

Pickup and drop cities auto-fill KM and delivery time from the route matrix.
If the pair is not in the matrix, the calculator falls back to CFT rate + KM rate.

Service pricing types: fixed, per item, per box, per KM, per hour, percentage.

Change a rate or an item’s CFT on an Admin page, return to the calculator, and the new value is used immediately. Data survives a refresh.

## Item master seed

Seed items follow the business list in the reference sheet (TV Unit, Center Table, Sofa 2 Seater, Book Shelf, carton boxes, etc.) plus common household items. Unit CFT for sheet rows with a quantity was derived as `Space in CFT ÷ Qty` where both were present.

Employees can add, edit, or import a full catalogue from Settings → Import JSON.

## Project layout

```
index.html
css/styles.css
data/defaults.js          seed masters (first run / factory reset only)
js/app.js                 hash router + chrome
js/services/storage.js    localStorage adapter
js/services/masters.js    item / vehicle / rate / order / settings services
js/utils/calculations.js  CFT, vehicle pick, pricing engine
js/utils/validation.js
js/utils/helpers.js
js/pages/*.js             screens
```

To point the same UI at a backend later, replace the functions inside `js/services/` with `fetch` calls. Pages already go through `ItemService`, `VehicleService`, `RateService`, and `OrderService`.

## Acceptance checks

1. Create a customer on Order Calculator.
2. Add several items and quantities — line CFT and total CFT update immediately.
3. Vehicle recommendation changes as CFT crosses configured capacities.
4. Enter distance and tick services — the breakdown and total update.
5. Change a vehicle floor price under Rate Configuration, return to the calculator — new price is used.
6. Change an item’s CFT in Item Master, return to the calculator — new CFT is used.
7. Refresh the browser — masters and saved orders are still there.
