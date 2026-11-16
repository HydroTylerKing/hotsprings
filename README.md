# Wildflower Touring · Hot Springs Map

An interactive map of 2,072 thermal (hot) springs in the United States: the 1,661 springs of NOAA's 1980 list (the data behind NOAA's retired NGDC hot springs viewer) plus 411 more from state geological surveys.

## Features

- Basemaps: USGS Topo, OpenTopoMap, satellite imagery (Esri), USGS imagery + topo, Esri Topo, shaded relief, OpenStreetMap streets, and Esri light and dark gray
- An optional road and place-label overlay for the imagery basemaps
- Springs colored by temperature (boiling, hot, warm, no data); the legend can be minimized and each class hidden
- A popup for each spring showing its name, linked to Google Maps, and its temperature
- Search by name, filter by state or minimum temperature, and sort by name, temperature or distance from you
- A results list limited to the current map view, which can expand into a full-screen table
- A "locate me" button and a distance column
- A land filter (any ownership, on public land, on public land with open access, on public land without open access, or on private land), with each spring's land unit and manager shown in its details
- Descriptions and photos for 174 springs from Wikipedia and Wikimedia Commons, with author, license and date credits
- Installable as an app (home-screen icon, full screen) with offline use: spring data, filters, saved springs and recently viewed map areas work without a signal
- **Save this area for offline** (download button under the locate button): saves USGS Topo tiles for the area on screen, down to trail-level detail (up to 5,000 tiles per area), plus Wikipedia/Commons details for the springs in it. Saved areas are listed under Basemap → Offline areas, and with no signal the map switches to USGS Topo inside a saved area. Only USGS maps are downloadable in bulk (public domain); other basemaps' terms don't allow it.
- Saved and visited springs, kept on your device, with a filter for each
- A °F/°C switch
- Shareable links to individual springs, such as `#spring-547`

## Data

*Thermal Springs List for the United States* — G. W. Berry, P. J. Grim and J. A. Ikelman, NOAA Key to Geophysical Records Documentation No. 12 (1980). The list was archived when NOAA decommissioned the product in May 2025: <https://doi.org/10.25921/c8p0-zs06>. The digitized copy used here comes from [dgketchum/ncei-thermal-springs](https://github.com/dgketchum/ncei-thermal-springs).

`data/springs.json` fields: `name, state, lat, lon, temp_f, temp_c, class, usgs_quad`. Class is `B` (≥ 90 °C), `H` (50–89 °C), `W` (< 50 °C), or the source's own B/H/W label when no temperature was recorded.

Land ownership comes from USGS [PAD-US 4.1](https://www.usgs.gov/programs/gap-analysis-project/science/pad-us-web-services) (the Fee Managers layer), checked at each spring's listed coordinates in November 2026. Each spring's last field, `land`, holds `[category, manager code, unit name]`, or `null` when no PAD-US parcel covers the point, which usually means private land. Category codes: `P` public with open access, `R` public with restricted access, `U` public with unknown access, `M` military, `T` tribal, `N` nonprofit preserve, `V` private. In the app, "On public land" means P, R or U, "On public land & open access" means P only, "On public land without open access" means R or U, and "On private land" means no PAD-US parcel, `V` or `N`. Some 1980 coordinates are off by hundreds of meters, so a spring near a boundary may be classed wrongly.

`data/media.json` matches 166 springs to an English Wikipedia article and/or a Wikimedia Commons photo (70 photos), by name and distance, with every match checked by hand (Nov 2026). Photos were reviewed one by one and kept only if they show the spring, pool or thermal feature itself (not signs, buildings, towns, maps or postcards). The text, photographer, license and dates load live from the Wikipedia and Commons APIs when a spring is opened, so credits stay current. Photos whose license isn't free are never shown. Google Maps photos are only taken from places Google classifies as natural features, parks, campgrounds, pools, spas or non-lodging attractions; towns and hotels are skipped. Wikipedia text is CC BY-SA 4.0.

The list has not been updated since 1980. Many springs are on private or closed land, so check access before you go.

## Install on a phone

**iPhone/iPad:** open the site in Safari, tap Share, then Add to Home Screen. **Android:** tap "Install app" in the header, or use the browser menu. The service worker in `sw.js` caches the app and data for offline use. Map tiles you view are kept, up to about 3,000; saved offline areas go in a separate `offline-v1` cache that is never trimmed. Tiles and photos are loaded with CORS so cached copies don't count as oversized "opaque" entries against storage. Google Maps photos are never cached.

## Deploy

This is a static site with no build step. To publish it with GitHub Pages, go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`.

To run it locally: `python3 -m http.server`, then open http://localhost:8000.

Leaflet 1.9.4 (BSD-2-Clause) is included in `vendor/leaflet`. Map tiles © USGS, Esri, OpenTopoMap and OpenStreetMap contributors, as credited on the map.

## State geological survey data

`tools/state_survey.py` (run by `.github/workflows/state-survey.yml` on GitHub Actions, on changes and quarterly) pulls the 4,701 thermal-spring records that state geological surveys contributed to the National Geothermal Data System, republished as AASG-GDS (Zaffos and Richard, 2025, [doi:10.5281/zenodo.8125526](https://doi.org/10.5281/zenodo.8125526), CC BY 4.0), and matches them to the NOAA list by distinctive name words and distance. `tools/merge_state_survey.py` then builds `data/springs.json` from the untouched NOAA file `data/noaa1980.json` and the results in `data/ss_raw.json`:

- **Newer readings** for 826 NOAA springs (the newest dated reading, shown next to NOAA's 1980 value; readings that disagree with NOAA by more than 40 °F are dropped as likely mismatches). Where NOAA listed no temperature, the survey reading is used.
- **More precise locations** for 423 NOAA springs: a name-matched survey record given to 4+ decimal places, 0.1–2 km from NOAA's point. NOAA's original point is kept in the `moved` field.
- **411 added springs**: survey records not matched to any NOAA spring, at least 20 °C (68 °F) or named hot/warm, more than 0.5 km from any NOAA spring and not sharing a name with one within 5 km; wells, fumaroles, NOAA-derived records and Tennessee's 1956 groundwater survey (mostly cold springs) are excluded, and duplicates within 300 m are merged.

Land ownership for added and moved springs is looked up in PAD-US at the new point. Each spring's source citation is shown in the app.
