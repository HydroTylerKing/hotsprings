"""Build data/springs.json (what the app loads) from data/noaa1980.json + data/ss_raw.json.

Fields per spring: name, state, lat, lon, temp_f, temp_c, class, usgs_quad, land, ss, moved, origin
  ss     [temp_f, temp_c, year, source_index, used_as_main] - newest state-survey reading (null if none, or if it
         disagrees with NOAA by more than 40 F, which usually means a mismatched record)
  moved  [noaa_lat, noaa_lon, source_index] when the marker uses a more precise state-survey location
  origin 'N' = NOAA 1980 list, 'S' = added from the state geological surveys
Springs added from the state surveys come after the 1,661 NOAA springs, so NOAA indexes never change."""
import json
noaa = json.load(open('data/noaa1980.json')); ss = json.load(open('data/ss_raw.json'))
cls = lambda f, name='': ('B' if f >= 194 else 'H' if f >= 122 else 'W') if f is not None else ('H' if 'HOT' in name.upper() else 'W')
rows = [r[:9] + [None, None, 'N'] for r in noaa['springs']]
dropped = 0
for u in ss['U']:
    i, f, c, yr, src = u[:5]; r = rows[i]
    if f is not None:
        if r[4] is not None and abs(r[4] - f) > 40: dropped += 1
        else:
            r[9] = [f, c, yr, src, 0]
            if r[4] is None:                          # NOAA listed no reading: use the state survey's
                r[4], r[5] = f, c; r[9][4] = 1
                if not r[6]: r[6] = cls(f)
    if len(u) > 5:
        lat, lon, land, lsrc = u[5:9]
        r[10] = [r[2], r[3], lsrc]; r[2], r[3], r[8] = lat, lon, land
for name, st, lat, lon, f, c, yr, src, land in ss['NW']:
    rows.append([name, st, lat, lon, f, c, cls(f, name), '', land, [f, c, yr, src, 1], None, 'S'])
out = dict(noaa)
out['fields'] = ['name', 'state', 'lat', 'lon', 'temp_f', 'temp_c', 'class', 'usgs_quad', 'land', 'ss', 'moved', 'origin']
out['ss_source'] = ('State geological survey thermal-spring records from the National Geothermal Data System, republished as AASG-GDS '
                    '(Zaffos and Richard, 2025, doi:10.5281/zenodo.8125526, CC BY 4.0), fetched ' + ss['fetched'] + '.')
out['ss_sources'] = ss['SRC']
out['springs'] = rows
json.dump(out, open('data/springs.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(rows), 'springs;', sum(r[11] == 'S' for r in rows), 'added;', sum(r[9] is not None for r in rows if r[11] == 'N'), 'NOAA with state reading;',
      sum(r[10] is not None for r in rows), 'moved;', dropped, 'readings dropped (>40 F off)')
