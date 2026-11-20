"""Fetch Canadian thermal-spring data (runs in GitHub Actions; this workspace can't reach these sites).

Sources
  1. Yukon Geological Survey, Geothermal Thermal Springs (shapefile; names, temperatures). Open Government Licence - Yukon.
  2. Canadian Geographical Names Database (CGNDB) via the GeoNames API: features whose generic term is
     Hotspring / Hot Spring (code 1152) and other springs named hot/warm. Open Government Licence - Canada.
  3. GSC Open File 6167 (Grasby et al. 2009) PDF: text dumped for review (spring table with temperatures).
Output: data/ca_raw.json (+ data/ca_of6167.txt for review)
"""
import io, json, re, subprocess, sys, time, zipfile, urllib.request, urllib.parse

UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 hotsprings-map'}
OUT = {'yukon': [], 'cgndb': [], 'notes': []}

def get(url, timeout=90):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

# 1. Yukon thermal springs shapefile
try:
    import shapefile  # pyshp
    from pyproj import Transformer
    z = zipfile.ZipFile(io.BytesIO(get('https://map-data.service.yukon.ca/geoyukon/Geological/Geothermal_Thermal_Springs/Geothermal_Thermal_Springs.shp.zip')))
    names = z.namelist(); print('yukon zip:', names)
    base = [n[:-4] for n in names if n.lower().endswith('.shp')][0]
    rd = shapefile.Reader(shp=io.BytesIO(z.read(base + '.shp')), dbf=io.BytesIO(z.read(base + '.dbf')), shx=io.BytesIO(z.read(base + '.shx')))
    prj = z.read(base + '.prj').decode() if base + '.prj' in names else ''
    print('yukon prj:', prj[:200])
    tr = Transformer.from_crs(prj, 'EPSG:4326', always_xy=True) if prj and 'GEOGCS' not in prj[:8] else None
    fields = [f[0] for f in rd.fields[1:]]
    print('yukon fields:', fields)
    for sr in rd.iterShapeRecords():
        x, y = sr.shape.points[0]
        if tr: x, y = tr.transform(x, y)
        rec = dict(zip(fields, [v if not isinstance(v, bytes) else v.decode('latin1') for v in sr.record]))
        rec['_lon'], rec['_lat'] = round(x, 5), round(y, 5)
        OUT['yukon'].append(rec)
    print('yukon records:', len(OUT['yukon']))
except Exception as e:
    OUT['notes'].append('yukon failed: %r' % e); print('yukon failed', e)

# 2. CGNDB springs (concise type SPRG), per province, paged
PROV = ['59', '48', '60', '61', '47', '46', '35', '24', '13', '12', '11', '10', '62']
seen = set()
for pv in PROV:
    skip = 0
    while True:
        q = urllib.parse.urlencode({'concise': 'SPRG', 'province': pv, 'num': 1000, 'skip': skip})
        try:
            d = json.loads(get('https://geogratis.gc.ca/services/geoname/en/geonames.json?' + q))
        except Exception as e:
            OUT['notes'].append('cgndb %s skip %d failed: %r' % (pv, skip, e)); print('cgndb fail', pv, e); break
        items = d.get('items', [])
        for it in items:
            if it['id'] in seen: continue
            seen.add(it['id'])
            OUT['cgndb'].append({'id': it['id'], 'name': it.get('name'), 'lat': it.get('latitude'), 'lon': it.get('longitude'),
                                 'prov': (it.get('province') or {}).get('code'), 'generic': (it.get('generic') or {}).get('code'),
                                 'generic_t': (it.get('generic') or {}).get('term'), 'status': (it.get('status') or {}).get('code'),
                                 'location': it.get('location')})
        print('cgndb', pv, skip, len(items), flush=True)
        if len(items) < 1000: break
        skip += 1000; time.sleep(0.5)
# name searches: hot springs filed under other feature types (localities, parks, etc.)
for term in ['hot*', 'warm*', 'thermal*', '*hotspring*', '*chaude*', 'radium*', 'miette*', 'liard*']:
    skip = 0
    while True:
        q = urllib.parse.urlencode({'q': term, 'num': 1000, 'skip': skip})
        try:
            d = json.loads(get('https://geogratis.gc.ca/services/geoname/en/geonames.json?' + q))
        except Exception as e:
            OUT['notes'].append('cgndb q %s failed: %r' % (term, e)); print('cgndb q fail', term, e); break
        items = d.get('items', [])
        for it in items:
            if it['id'] in seen: continue
            seen.add(it['id'])
            OUT['cgndb'].append({'id': it['id'], 'name': it.get('name'), 'lat': it.get('latitude'), 'lon': it.get('longitude'),
                                 'prov': (it.get('province') or {}).get('code'), 'generic': (it.get('generic') or {}).get('code'),
                                 'generic_t': (it.get('generic') or {}).get('term'), 'concise': (it.get('concise') or {}).get('code'),
                                 'status': (it.get('status') or {}).get('code'), 'location': it.get('location'), 'via': term})
        print('cgndb q', term, skip, len(items), flush=True)
        if len(items) < 1000: break
        skip += 1000; time.sleep(0.5)
print('cgndb springs:', len(OUT['cgndb']))

# 3. GSC open files: text dumped for review (spring tables with temperatures)
for tag, url in [('of6167', 'https://download-telecharger.services.geo.ca/pub/nrcan_rncan/publications/STPublications_PublicationsST/247/247765/of_6167.pdf'),
                 ('of6914', 'https://download-telecharger.services.geo.ca/pub/nrcan_rncan/publications/STPublications_PublicationsST/291/291488/gid_291488.pdf')]:
    try:
        pdf = get(url, 240)
        open('/tmp/%s.pdf' % tag, 'wb').write(pdf)
        subprocess.run(['pdftotext', '-layout', '/tmp/%s.pdf' % tag, 'data/ca_%s.txt' % tag], check=True)
        print(tag, 'text lines:', sum(1 for _ in open('data/ca_%s.txt' % tag)))
    except Exception as e:
        OUT['notes'].append('%s failed: %r' % (tag, e)); print(tag, 'failed', e)

json.dump(OUT, open('data/ca_raw.json', 'w'), indent=0, ensure_ascii=False)
