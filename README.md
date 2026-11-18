# for-sale-watch

Bookkeeping branch for a weekly scheduled check of whether privately owned hot springs on the map (data/springs.json on main) are listed for sale.

`seen.json` records every listing already reported: `{url, spring_index, spring_name, title, price, first_seen}`. `spring_index` is the position in `springs` in data/springs.json. Only listings not in this file are reported as new.

This branch does not affect the website, which publishes from main.
