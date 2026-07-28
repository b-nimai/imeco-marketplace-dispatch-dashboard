# Marketplace Dispatch Dashboard

Wall display answering one question off the `Outbound Tracker` sheet: **which product goes
where**. Products are rows, channels are columns; the shading is Excel's red→yellow→green
scale applied per row, so each row shows that product's own channel mix.

Month tabs across the top (`All time · Apr · May · …`) open on the current month. A `Total`
row pins the channel totals above the grid and a `Total` column sits beside the product name.

```bash
npm install
npm run dev      # vite --host, so the TV can reach it over LAN
npm test         # 37 tests, incl. reconciliation against a real sheet snapshot
npm run build
```

Requires `.env` (gitignored) with `VITE_GOOGLE_API_KEY` and `VITE_DISPATCH_SPREADSHEET_ID` —
see `.env.example`. The key is inlined into the client bundle by design; it is protected by
its Sheets-API-only + HTTP-referrer restrictions in Google Cloud, not by secrecy.

## API budget

A `spreadsheets.get` lists the workbook's tabs, then one `values:batchGet` fetches all of
them:

| | Sheets API calls |
|---|---|
| Cold load | **2** (tab list + batchGet) |
| Page reload within the hour | **0** (served from `localStorage`) |
| Hourly revalidation | 2 |
| Manual refresh (click the logo) | 2 |

Ranges are open-ended (`'AMAZON'!2:25`), so **new date columns appear with no code change** —
and because the tab list is discovered rather than hardcoded, **a new channel tab is picked up
with no code change either**. If the metadata call fails, the fetch falls back to the six
marketplace groups' known tabs and the dashboard still renders.

Discovered tabs are validated before use: a tab whose column A does not carry the same SKU IDs
in the same order as `Dashboard Ready Product` is skipped, so a notes or summary sheet cannot
be mistaken for dispatch data.

## The sheet's shape

Every tab: row 2 is the header (`SKU ID · Product Name · Product Name (V2) · Total`), rows
3–25 are the same 23 SKUs in the same order, and date columns run right from `E`.

`Dashboard Ready Product` is a live rollup of all 25 channels and reconciles exactly with each
tab's `Total`. The **All time** tab reads it directly — no aggregation, no drift. The **month**
tabs are rebuilt independently from the 11 dated dispatch tabs, and `parseSheet.test.ts` asserts
the two agree to the unit. That assertion is the tripwire for the parser silently dropping a
column.

### `Other`

The 14 channels outside the six marketplace groups — CRED, Shopify, First Club, Swiggy
Instamart, Big-Basket, Snapdeal, Modern Commerce, Shopclus, POP CLUB, Samples, JioMart, NYKAA,
SMYTTEN, Stock Block — merge into one `Other` column. Tab discovery reads their dated tabs like
any other, so `Other` is month-wise as well as all-time; `heatmapColumnForTab()` folds them in
exactly as `heatmapColumnForDrpHeader()` already did for the rollup's columns.

`reconciliation` carries an `other` entry whose `delta` is the meter for how complete that is:
`fromTabs` vs the rollup's 90,588 all-time units. A non-zero delta means some of those channels
still have no dated tab, and those units show up on **All time** only — which is what makes
All time larger than Apr+May+Jun+Jul. When the delta reaches 0 the tabs and the months agree
exactly. `scope.hasOther` is false only when a month found no `other` units at all, and the
column renders `·` rather than a misleading zero.

### Dirty headers

Roughly 8% of date columns aren't dates — ranges, embedded PO numbers, a `May`→`Mat` typo,
one header holding two dates, and five carrying no date at all. `parseDate.ts` handles each
case and `parseDate.test.ts` pins all of them against strings copied from the live sheet.

The five undated columns hold **33,539 real units** (36% of RK World's volume). They are
attributed to the nearest dated column on their left, which also decides the month they land
in — 11,951 in Jun and 21,588 in Jul, pinned by `parseSheet.test.ts`.

## Things that will bite you

- **The colour scale is per row, anchored on the row's median** (`src/lib/heatmapScale.ts`).
  Channel volume is violently skewed — Blinkit alone is over half of everything — so anchoring
  yellow at the mid-point of the range drops all but the dominant cell onto flat red and
  destroys the ranking the colour exists to show. Zeros are excluded from the median and render
  as `·`, never as red: red must mean "real but negligible".
- **Don't reorder the series colours** in `src/data/channels.ts`. They are categorical slots
  1–6 of a validated palette and the *order* is the colourblind-safety mechanism. Brand-matching
  the hues was tried and fails hard (magenta beside aqua collapses to ΔE 1.6 under deuteranopia).
  Re-run the validator before changing anything there. (The heatmap does not use them.)
- **Product names are overridden** in `src/data/products.ts`, keyed by SKU ID, because the
  sheet's own names run to 76 characters. A test asserts the map and the sheet cover exactly
  the same SKUs, so adding a product to the sheet fails the suite until it is named.
- **Tailwind v4 is CSS-first.** Theme tokens live in `src/index.css`, not a `tailwind.config.js`.
- `FBF` books dispatches days ahead of today, so its planned units count toward the current
  month's totals; the "Last dispatch" KPI deliberately ignores anything after today.
