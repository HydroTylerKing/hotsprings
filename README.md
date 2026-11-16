# Wildflower Touring · Hot Springs Map

An interactive map of 1,661 thermal (hot) springs in the United States, rebuilt from NOAA's retired NGDC hot springs viewer.

## Features

- Basemaps: USGS Topo, OpenTopoMap, satellite imagery (Esri), USGS imagery + topo, Esri Topo, shaded relief, OpenStreetMap streets, light and dark
- An optional road and place-label overlay for the imagery basemaps
- Springs colored by temperature (boiling, hot, warm, no data); the legend can be minimized and each class hidden
- A popup for each spring showing its name, linked to Google Maps, and its temperature
- Search by name, filter by state or minimum temperature, and sort by name, temperature or distance from you
- A results list limited to the current map view, which can expand into a full-screen table
- A "locate me" button and a distance column
- A land filter (any ownership, on public land, on public land with open access, on public land without open access, or on private land), with each spring's land unit and manager shown in its details
- Descriptions and photos for 174 springs from Wikipedia and Wikimedia Commons, with author, license and date credits
- Installable as an app (home-screen icon, full screen) with offline use: spring data, filters, saved springs and recently viewed map areas work without a signal
- Saved and visited springs, kept on your device, with a filter for each
- A °F/°C switch
- Shareable links to individual springs, such as `#spring-547`

## Data

*Thermal Springs List for the United States* — G. W. Berry, P. J. Grim and J. A. Ikelman, NOAA Key to Geophysical Records Documentation No. 12 (1980). The list was archived when NOAA decommissioned the product in May 2025: <https://doi.org/10.25921/c8p0-zs06>. The digitized copy used here comes from [dgketchum/ncei-thermal-springs](https://github.com/dgketchum/ncei-thermal-springs).

`data/springs.json` fields: `name, state, lat, lon, temp_f, temp_c, class, usgs_quad`. Class is `B` (≥ 90 °C), `H` (50–89 °C), `W` (< 50 °C), or the source's own B/H/W label when no temperature was recorded.

Land ownership comes from USGS [PAD-US 4.1](https://www.usgs.gov/programs/gap-analysis-project/science/pad-us-web-services) (the Fee Managers layer), checked at each spring's listed coordinates in November 2026. Each spring's last field, `land`, holds `[category, manager code, unit name]`, or `null` when no PAD-US parcel covers the point, which usually means private land. Category codes: `P` public with open access, `R` public with restricted access, `U` public with unknown access, `M` military, `T` tribal, `N` nonprofit preserve, `V` private. In the app, "On public land" means P, R or U, "On public land & open access" means P only, "On public land without open access" means R or U, and "On private land" means no PAD-US parcel, `V` or `N`. Some 1980 coordinates are off by hundreds of meters, so a spring near a boundary may be classed wrongly.

`data/media.json` matches 174 springs to an English Wikipedia article and/or a Wikimedia Commons photo, by name and distance, with every match checked by hand (Nov 2026). The text, photographer, license and dates load live from the Wikipedia and Commons APIs when a spring is opened, so credits stay current. Photos whose license isn't free are never shown. Wikipedia text is CC BY-SA 4.0.

The list has not been updated since 1980. Many springs are on private or closed land, so check access before you go.

## Install on a phone

**iPhone/iPad:** open the site in Safari, tap Share, then Add to Home Screen. **Android:** tap "Install app" in the header, or use the browser menu. The service worker in `sw.js` caches the app and data for offline use. Map tiles you view are kept, up to about 3,000. Google Maps photos are never cached.

## Deploy

This is a static site with no build step. To publish it with GitHub Pages, go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`.

To run it locally: `python3 -m http.server`, then open http://localhost:8000.

Leaflet 1.9.4 (BSD-2-Clause) is included in `vendor/leaflet`. Map tiles © USGS, Esri, OpenTopoMap, OpenStreetMap contributors and CARTO, as credited on the map.
