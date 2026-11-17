"""Gather web evidence on whether people soak in each spring at or above 90 F, for a judgement pass.
Writes data/rec_evidence.json: {index: {"osm": [...], "wiki": [...]}}
  osm  - OpenStreetMap features within 600 m: [kind, name, distance_m, notable tags]
         (natural=hot_spring, amenity=public_bath, leisure=bathing_place, and pools/resorts/tourism named like a spring)
  wiki - English Wikipedia articles within 1.5 km: [title, distance_m, soaking keywords found in the intro]
OpenStreetMap data (c) OpenStreetMap contributors, ODbL."""
import json, math, re, time, urllib.parse, urllib.request
from collections import defaultdict
UA = {'User-Agent': 'wildflower-touring-hotsprings/1.0 (https://hydrotylerking.github.io/hotsprings/)'}
def fetch(url, data=None, tries=4):
    for t in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=900) as r: return json.load(r)
        except Exception as e:
            if t == tries - 1: raise
            time.sleep(15 * (t + 1))
def km(a, b, c, d):
    t = math.pi / 180; x = (c - a) * t; y = (d - b) * t
    h = math.sin(x / 2) ** 2 + math.cos(a * t) * math.cos(c * t) * math.sin(y / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))

S = json.load(open('data/springs.json'))['springs']
H = [(i, r) for i, r in enumerate(S) if r[4] is not None and r[4] >= 90]
print('springs >= 90F:', len(H))

# ---- OpenStreetMap via Overpass (US, Alaska, Hawaii, Puerto Rico)
Q = '''[out:json][timeout:900];
(area["ISO3166-1"="US"][admin_level=2]; area["ISO3166-1"="PR"][admin_level=2];)->.us;
( nwr["natural"="hot_spring"](area.us);
  nwr["amenity"="public_bath"](area.us);
  nwr["leisure"="bathing_place"](area.us);
  nwr["leisure"~"^(swimming_pool|water_park|resort|sports_centre)$"]["name"~"spring|thermal|plunge|bath|hot pool|natatorium",i](area.us);
  nwr["tourism"]["name"~"hot spring|warm spring|thermal",i](area.us);
  nwr["amenity"="spa"]["name"~"spring|thermal|bath",i](area.us);
);
out center tags;'''
osm = []
for ep in ('https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'):
    try:
        j = fetch(ep, data=urllib.parse.urlencode({'data': Q}).encode()); osm = j['elements']; break
    except Exception as e: print('overpass', ep, 'failed:', e)
print('OSM features:', len(osm))
KEEP = ('natural', 'amenity', 'leisure', 'tourism', 'bathing', 'swimming', 'access', 'fee', 'opening_hours', 'website', 'operator', 'nudism', 'temperature', 'description', 'note', 'hot_spring', 'sport', 'shop', 'drinking_water')
G = defaultdict(list)
for e in osm:
    lat = e.get('lat') or (e.get('center') or {}).get('lat'); lon = e.get('lon') or (e.get('center') or {}).get('lon')
    if lat is None: continue
    t = e.get('tags', {})
    kind = 'hot_spring' if t.get('natural') == 'hot_spring' else t.get('amenity') or t.get('leisure') or t.get('tourism') or '?'
    tags = {k: v[:80] for k, v in t.items() if k in KEEP and k not in ('natural',)}
    G[(int(lat // 0.02), int(lon // 0.02))].append((lat, lon, kind, t.get('name', ''), tags))

out = {}
for i, r in H:
    lat, lon = r[2], r[3]; a, b = int(lat // 0.02), int(lon // 0.02); hits = []
    for x in (a - 1, a, a + 1):
        for y in (b - 1, b, b + 1):
            for f in G.get((x, y), ()):
                d = km(lat, lon, f[0], f[1])
                if d <= 0.6: hits.append([f[2], f[3], round(d * 1000), f[4]])
    hits.sort(key=lambda h: h[2])
    out[i] = {'osm': hits[:6], 'wiki': []}

# ---- Wikipedia articles near each spring
KW = re.compile(r'\b(soak\w*|bath\w*|swim\w*|pool\w*|resort|spa\b|tub\w*|clothing.optional|nud\w*|recreation\w*|visitors?|camp\w*|lodge|hike|trail|plunge|developed|commercial|popular|closed|private|no public|off.limits|scald\w*|dangerous|prohibit\w*)', re.I)
API = 'https://en.wikipedia.org/w/api.php'
def wq(p): return fetch(API + '?' + urllib.parse.urlencode(dict({'format': 'json', 'formatversion': 2}, **p)))
titles = {}
for n, (i, r) in enumerate(H):
    try:
        j = wq({'action': 'query', 'list': 'geosearch', 'gscoord': f'{r[2]}|{r[3]}', 'gsradius': 1500, 'gslimit': 8})
        for g in j['query']['geosearch']:
            out[i]['wiki'].append([g['title'], round(g['dist'])]); titles[g['title']] = None
    except Exception as e: print('geosearch failed', i, e)
    time.sleep(0.15)
tl = list(titles)
for k in range(0, len(tl), 20):
    try:
        j = wq({'action': 'query', 'prop': 'extracts', 'exintro': 1, 'explaintext': 1, 'titles': '|'.join(tl[k:k + 20]), 'redirects': 1})
        for pg in j['query']['pages']: titles[pg['title']] = pg.get('extract', '') or ''
    except Exception as e: print('extracts failed', e)
    time.sleep(0.3)
for i in out:
    w = []
    for t, d in out[i]['wiki']:
        ex = titles.get(t) or ''
        kws = sorted({m.group(1).lower() for m in KW.finditer(ex)})
        if re.search(r'(?i)spring|geyser|bath|pool|resort|spa|thermal|hot', t + ' ' + ex[:300]) or kws:
            w.append([t, d, kws[:12], re.sub(r'\s+', ' ', ex)[:400]])
    out[i]['wiki'] = w
json.dump(out, open('data/rec_evidence.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print('with OSM evidence:', sum(1 for v in out.values() if v['osm']), '| with Wikipedia evidence:', sum(1 for v in out.values() if v['wiki']))
