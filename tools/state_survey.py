"""Fetch thermal springs from the National Geothermal Data System (state geological surveys, AASG-GDS,
CC BY 4.0) and match them to the NOAA 1980 list in data/noaa1980.json.

Writes data/ss_raw.json = {SRC: [citations], U: [updates for NOAA springs], NW: [new springs]}:
  U row:  [noaa_index, temp_f, temp_c, year, src] + optionally [lat, lon, land, loc_src] when a
          name-matched state-survey record gives a more precise location 0.1-2 km away
  NW row: [name, state, lat, lon, temp_f, temp_c, year, src, land]
Run by .github/workflows/state-survey.yml (GitHub's runners can reach the ArcGIS services)."""
import json, math, re, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

AASG = 'https://services1.arcgis.com/Ezk9fcjSUkeadg6u/arcgis/rest/services/ngdsdata/FeatureServer/2/query'
PADUS = 'https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Fee_Managers_PADUS/FeatureServer/0/query'

def get(url, params, tries=4):
    q = url + '?' + urllib.parse.urlencode(params)
    for t in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(q, headers={'User-Agent': 'wildflower-touring-hotsprings'}), timeout=60) as r:
                j = json.load(r)
            if 'error' in j: raise RuntimeError(j['error'])
            return j
        except Exception:
            if t == tries - 1: raise
            time.sleep(2 + 2 * t)

GEN = set('HOT WARM SPRING SPRINGS SPGS SPG SPR THERMAL UNNAMED UNKNOWN NO NUMBER AREA GROUP WELL AT NEAR NR THE OF AND COUNTY CO A B C D E N S W NORTH SOUTH EAST WEST UPPER LOWER LITTLE BIG OLD NEW 1 2 3 4 5 6'.split())
def toks(s, minlen=1, extra=()):
    ws = re.sub(r'[^A-Z0-9 ]', ' ', (s or '').upper()).split()
    return list(dict.fromkeys(w[:-1] if w.endswith('S') else w for w in ws if len(w) >= minlen and w not in GEN and w not in extra))
def lev(a, b):
    if abs(len(a) - len(b)) > 2: return 9
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1): cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]
def hit(w, lst): return any(x == w or (len(w) >= 5 and len(x) >= 5 and lev(w, x) <= 2) for x in lst)
def km(a, b, c, d):
    t = math.pi / 180; x = (c - a) * t; y = (d - b) * t
    h = math.sin(x / 2) ** 2 + math.cos(a * t) * math.cos(c * t) * math.sin(y / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))
def dec(v):
    s = repr(float(v)); return len(s.split('.')[1]) if '.' in s and s.split('.')[1] != '0' else 0

EAST = {'TN', 'WV', 'VA', 'GA', 'NC', 'MA', 'NH', 'MD', 'PA', 'NY', 'VT', 'ME', 'CT', 'AL', 'KY', 'SC'}
FIXED = [0]

# ---- fetch state-survey records
F = 'OBJECTID,springname,othername,featuretype,originating_state,latdegree,longdegree,temperature,temperatureunits,tempmeasurementdatetime,source'
raw, off = [], 0
while True:
    j = get(AASG, {'where': '1=1', 'outFields': F, 'orderByFields': 'OBJECTID', 'resultOffset': off, 'resultRecordCount': 2000, 'f': 'json'})
    raw += [f['attributes'] for f in j['features']]
    if len(j['features']) < 2000: break
    off += 2000
print('state-survey records:', len(raw))

A = []
for a in raw:
    lat, lon = a.get('latdegree'), a.get('longdegree')
    if not lat or not lon or abs(lat) > 90: continue
    u = (a.get('temperatureunits') or '').strip(); t = a.get('temperature'); c = None
    if re.fullmatch(r'-?[\d.]+', u): c = float(u)            # some rows carry the reading in the units field
    elif t is not None and t > -99: c = (t - 32) * 5 / 9 if u == 'F' else t
    # Eastern springs top out near 40 C (Hot Springs, VA); a Celsius reading above 45 there is really Fahrenheit
    if c is not None and u != 'F' and c > 45 and a.get('originating_state') in EAST: c = (c - 32) * 5 / 9; FIXED[0] += 1
    if c is not None and not (0 <= c <= 105): c = None
    d = a.get('tempmeasurementdatetime') or ''; yr = int(d[:4]) if d[:4].isdigit() and int(d[:4]) > 1901 else None   # 1899-1901 are placeholders
    src = re.sub(r'\s+', ' ', (a.get('source') or '').strip())
    ft = (a.get('featuretype') or '').lower(); name = (a.get('springname') or '').strip()
    A.append(dict(id=a['OBJECTID'], name=name, st=a.get('originating_state'), lat=lat, lon=lon, prec=min(dec(lat), dec(lon)), c=c, yr=yr, src=src,
                  copy=bool(re.search(r'NOAA National Geophysical|Berry, George|Berry, G\.W|Thermal Springs List', src, re.I)),
                  well=('well' in ft and 'spring' not in ft), tk=toks(name + ' ' + (a.get('othername') or ''))))

S = json.load(open('data/noaa1980.json'))['springs']
N = [dict(i=i, lat=r[2], lon=r[3], tk=toks(r[0])) for i, r in enumerate(S)]

# ---- match each record to the best NOAA spring (name words, small spelling slips allowed; distance-only only when very close)
for a in A:
    if a['copy'] or a['well']: continue
    best = None
    for n in N:
        if abs(n['lat'] - a['lat']) > 0.05 or abs(n['lon'] - a['lon']) > 0.07: continue
        d = km(n['lat'], n['lon'], a['lat'], a['lon'])
        if d > 4: continue
        if n['tk']:
            sc = sum(hit(w, a['tk']) for w in n['tk']) / len(n['tk'])
            if sc >= 0.5: kind = 'name'
            elif d <= 0.25: kind, sc = 'near', 0.1
            else: continue
        else:
            if d > 0.3: continue
            kind, sc = 'near', 0.05
        key = sc * 10 - d
        if not best or key > best[0]: best = (key, n['i'], d, kind)
    if best: a['m'], a['md'], a['kind'] = best[1], best[2], best[3]

per = {}
for a in A:
    if 'm' in a: per.setdefault(a['m'], []).append(a)
out = {}
for i, l in per.items():
    temps = sorted([a for a in l if a['c'] is not None], key=lambda a: (-(a['yr'] or 0), a['kind'] != 'name', a['md']))
    locs = sorted([a for a in l if a['kind'] == 'name' and a['prec'] >= 4 and 0.1 <= a['md'] <= 2], key=lambda a: (-a['prec'], a['md']))
    if temps or locs: out[i] = (temps[0] if temps else None, locs[0] if locs else None)

# ---- new springs: every unmatched spring (any temperature), not near or named like a NOAA spring
GEN2 = {'COMPLEX'}
NT = [dict(lat=r[2], lon=r[3], tk=toks(r[0], 3, GEN2)) for r in S]
def clean(n): return re.sub(r'\s+', ' ', re.sub(r'^[A-Za-z .]+ County ', '', n)).strip()
cands = [a for a in A if 'm' not in a and not a['copy'] and not a['well']
         and not re.search(r'fumarole|gas vent|\bgas\b|\bmine\b|\bwell\b', a['name'], re.I)]
cands = [a for a in cands if not any(abs(la - a['lat']) < 0.01 and abs(lo - a['lon']) < 0.013 and km(la, lo, a['lat'], a['lon']) < 0.5 for la, lo in ((r[2], r[3]) for r in S))]
cands = [a for a in cands if not any(abs(n['lat'] - a['lat']) < 0.05 and abs(n['lon'] - a['lon']) < 0.07 and km(n['lat'], n['lon'], a['lat'], a['lon']) < 5
                                     and set(toks(clean(a['name']), 3, GEN2)) & set(n['tk']) for n in NT)]
cands.sort(key=lambda a: (a['c'] is None, -(a['yr'] or 0), -a['prec']))
keep = []
for a in cands:
    if not any(km(k['lat'], k['lon'], a['lat'], a['lon']) < 0.3 and (any(hit(w, a['tk']) for w in k['tk']) or not k['tk'] or not a['tk']) for k in keep):
        keep.append(a)
for a in keep:
    n = clean(a['name']) or 'Unnamed spring'
    a['dname'] = 'Unnamed spring' if re.match(r'^(unnamed|no name|spring$|missing$|unknown$|none$)', n, re.I) else n

# ---- land ownership (PAD-US 4.1 Fee Managers) at new springs and moved locations
ORDER = {'OA': 0, 'RA': 1, 'UK': 2, 'XA': 3}
def land(lat, lon):
    j = get(PADUS, {'geometry': f'{lon},{lat}', 'geometryType': 'esriGeometryPoint', 'inSR': 4326, 'spatialRel': 'esriSpatialRelIntersects',
                    'outFields': 'Mang_Type,Mang_Name,Pub_Access,Unit_Nm', 'returnGeometry': 'false', 'f': 'json'})
    fs = sorted(j.get('features') or [], key=lambda f: ORDER.get(f['attributes'].get('Pub_Access'), 4))
    if not fs: return None
    a = fs[0]['attributes']; mt, mn = a.get('Mang_Type'), a.get('Mang_Name')
    c = 'T' if mt == 'TRIB' else 'M' if mn in ('DOD', 'ARMY', 'NAVY', 'USAF', 'USMC') else 'N' if mt == 'NGO' else 'V' if mt == 'PVT' else {'OA': 'P', 'RA': 'R', 'XA': 'R', 'UK': 'U'}.get(a.get('Pub_Access'), 'U')
    return [c, mn, a.get('Unit_Nm') or '']
jobs = [a for a in keep] + [loc for t, loc in out.values() if loc]
with ThreadPoolExecutor(6) as ex:
    for a, l in zip(jobs, ex.map(lambda a: land(a['lat'], a['lon']), jobs)): a['land'] = l

# ---- package
SRC, si = [], {}
def sidx(s):
    if len(s) > 220: s = re.sub(r'\s+\S*$', '', s[:217]) + '…'
    if s not in si: si[s] = len(SRC); SRC.append(s)
    return si[s]
r1 = lambda v: None if v is None else round(v, 1)
ll = lambda v: round(v, 5)
F_ = lambda c: None if c is None else round(c * 9 / 5 + 32)
U = []
for i in sorted(out):
    t, loc = out[i]
    row = [i, F_(t['c']) if t else None, r1(t['c']) if t else None, t['yr'] if t else None, sidx(t['src']) if t else None]
    if loc: row += [ll(loc['lat']), ll(loc['lon']), loc['land'], sidx(loc['src'])]
    U.append(row)
NW = [[a['dname'], a['st'], ll(a['lat']), ll(a['lon']), F_(a['c']), r1(a['c']), a['yr'], sidx(a['src']), a['land']] for a in keep]
json.dump({'SRC': SRC, 'U': U, 'NW': NW, 'fetched': time.strftime('%Y-%m-%d')}, open('data/ss_raw.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print('eastern C/F fixes:', FIXED[0])
print('NOAA springs updated:', len(U), '| moved:', sum(1 for r in U if len(r) > 5), '| new springs:', len(NW), '| sources:', len(SRC))
