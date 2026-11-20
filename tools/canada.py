"""Fetch Canadian thermal-spring data (runs in GitHub Actions; this workspace can't reach these sites).

Sources
  1. Yukon Geological Survey, Geothermal Thermal Springs (shapefile; names, temperatures). Open Government Licence - Yukon.
  2. Canadian Geographical Names Database (CGNDB) via the GeoNames API: features whose generic term is
     Hotspring / Hot Spring (code 1152) and other springs named hot/warm. Open Government Licence - Canada.
  3. GSC Open File 6167 (Grasby et al. 2009) PDF: text dumped for review (spring table with temperatures).
Output: data/ca_raw.json (small) (+ data/ca_of6167.txt for review)
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

# 2. CGNDB: the full pre-packaged national CSV (weekly), filtered here to names that mention hot/warm/thermal springs
import csv, html
HOT = re.compile(r'\b(hot|warm|thermal|chaudes?|hotsprings?|hotspring)\b', re.I)
try:
    base = 'https://ftp.maps.canada.ca/pub/nrcan_rncan/vector/geobase_cgn_toponyme/prov_csv_eng/'
    listing = get(base).decode('utf8', 'replace')
    files = sorted(set(re.findall(r'href="([^"]+\.(?:zip|csv))"', listing, re.I)))
    print('cgn files:', files)
    pick = [f for f in files if re.search(r'canada', f, re.I)] or files
    rows = []
    for f in pick[:1]:
        raw = get(base + f, 300)
        if f.lower().endswith('.zip'):
            zz = zipfile.ZipFile(io.BytesIO(raw)); name = [n for n in zz.namelist() if n.lower().endswith('.csv')][0]; raw = zz.read(name)
        txt = raw.decode('utf-8-sig', 'replace')
        rd2 = csv.DictReader(io.StringIO(txt))
        print('cgn columns:', rd2.fieldnames)
        for r in rd2:
            nm = r.get('Geographical Name') or r.get('GEONAME') or r.get('Name') or ''
            gen = r.get('Generic Term') or r.get('GENERIC') or ''
            if HOT.search(nm) or 'hot spring' in gen.lower() or 'hotspring' in gen.lower():
                rows.append(r)
    OUT['cgndb'] = rows
    print('cgn hot rows:', len(rows))
except Exception as e:
    OUT['notes'].append('cgn csv failed: %r' % e); print('cgn csv failed', e)

# 3. GSC open files: text dumped for review (spring tables with temperatures)
for tag, url in [('of6167', 'https://download-telecharger.services.geo.ca/pub/nrcan_rncan/publications/STPublications_PublicationsST/247/247765/of_6167.pdf'),
                 ('of6914', 'https://publications.gc.ca/collections/collection_2013/rncan-nrcan/M183-2-6914-eng.pdf')]:
    try:
        pdf = get(url, 240)
        open('/tmp/%s.pdf' % tag, 'wb').write(pdf)
        subprocess.run(['pdftotext', '-layout', '/tmp/%s.pdf' % tag, 'data/ca_%s.txt' % tag], check=True)
        print(tag, 'text lines:', sum(1 for _ in open('data/ca_%s.txt' % tag)))
    except Exception as e:
        OUT['notes'].append('%s failed: %r' % (tag, e)); print(tag, 'failed', e)

json.dump(OUT, open('data/ca_raw.json', 'w'), indent=0, ensure_ascii=False)
