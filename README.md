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
- A °F/°C switch
- Shareable links to individual springs, such as `#spring-547`

## Data

*Thermal Springs List for the United States* — G. W. Berry, P. J. Grim and J. A. Ikelman, NOAA Key to Geophysical Records Documentation No. 12 (1980). The list was archived when NOAA decommissioned the product in May 2025: <https://doi.org/10.25921/c8p0-zs06>. The digitized copy used here comes from [dgketchum/ncei-thermal-springs](https://github.com/dgketchum/ncei-thermal-springs).

`data/springs.json` fields: `name, state, lat, lon, temp_f, temp_c, class, usgs_quad`. Class is `B` (≥ 90 °C), `H` (50–89 °C), `W` (< 50 °C), or the source's own B/H/W label when no temperature was recorded.

The list has not been updated since 1980. Many springs are on private or closed land, so check access before you go.

## Deploy

This is a static site with no build step. To publish it with GitHub Pages, go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`.

To run it locally: `python3 -m http.server`, then open http://localhost:8000.

Leaflet 1.9.4 (BSD-2-Clause) is included in `vendor/leaflet`. Map tiles © USGS, Esri, OpenTopoMap, OpenStreetMap contributors and CARTO, as credited on the map.
