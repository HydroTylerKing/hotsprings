"""One-off: print fields, counts and samples of candidate spring sources."""
import json, urllib.request, urllib.parse, io, zipfile, csv, sys, collections
def get(u, raw=False):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'wildflower-touring-hotsprings'}), timeout=300); b = r.read()
    return b if raw else json.loads(b)
print('=== NBMG layer 8')
L = 'https://web2.nbmg.unr.edu/arcgis/rest/services/Nevada_data/05_GeothermalData/MapServer/8'
m = get(L + '?f=json'); print([f['name'] for f in m.get('fields', [])])
print(get(L + '/query?where=1%3D1&returnCountOnly=true&f=json'))
s = get(L + '/query?where=1%3D1&outFields=*&outSR=4326&resultRecordCount=3&f=json'); print(json.dumps(s.get('features', [])[:3])[:2500])
for f in ('TYPE','Type','type','SOURCE','Source'):
    try: print(f, get(L + '/query?where=1%3D1&outFields='+f+'&returnDistinctValues=true&returnGeometry=false&f=json')['features'][:40])
    except Exception as e: pass
print('=== NM xls')
import subprocess; subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'xlrd'])
import xlrd
b = get('https://gdr.openei.org/files/558/NewMexicoSpgs_Over_30C_AMP.xls', raw=True); wb = xlrd.open_workbook(file_contents=b)
for sh in wb.sheets():
    print(sh.name, sh.nrows, sh.ncols)
    for r in range(min(4, sh.nrows)): print(sh.row_values(r))
print('=== WQP stations (Spring) count by state sample')
for st in ('US:32', 'US:35', 'US:16'):
    u = 'https://www.waterqualitydata.us/data/Station/search?' + urllib.parse.urlencode({'statecode': st, 'siteType': 'Spring', 'characteristicName': 'Temperature, water', 'mimeType': 'csv', 'zip': 'no'})
    b = get(u, raw=True).decode('utf-8', 'replace'); rows = list(csv.DictReader(io.StringIO(b))); print(st, len(rows), list(rows[0].keys())[:40] if rows else '')
u = 'https://www.waterqualitydata.us/data/Result/search?' + urllib.parse.urlencode({'statecode': 'US:32', 'siteType': 'Spring', 'characteristicName': 'Temperature, water', 'mimeType': 'csv', 'zip': 'no', 'dataProfile': 'narrowResult'})
b = get(u, raw=True).decode('utf-8', 'replace'); rows = list(csv.DictReader(io.StringIO(b))); print('NV results', len(rows), list(rows[0].keys()) if rows else ''); print(rows[:2])
print('=== GNIS national')
for u in ['https://prd-tnm.s3.amazonaws.com/StagedProducts/GeographicNames/DomesticNames/DomesticNames_National_Text.zip']:
    try:
        b = get(u, raw=True); z = zipfile.ZipFile(io.BytesIO(b)); print(len(b), z.namelist()[:10])
        n = [x for x in z.namelist() if x.lower().endswith('.txt')][0]
        with z.open(n) as fh:
            t = io.TextIOWrapper(fh, 'utf-8', errors='replace'); rd = csv.DictReader(t, delimiter='|'); print(rd.fieldnames)
            c = collections.Counter(); ex = []
            for r in rd:
                if r.get('feature_class') == 'Spring': c[r.get('state_name')] += 1; ex.append(r) if len(ex) < 3 else None
            print('springs', sum(c.values()), c.most_common(10)); print(ex)
    except Exception as e: print('GNIS ERR', u, e)
