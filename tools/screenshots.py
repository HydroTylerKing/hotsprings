"""Take Play Store screenshots of the live site (run in GitHub Actions, where map tiles load).

Phone: 1080x1920 (9:16). Desktop: 1920x1080 (16:9). Output: store/screens/.
Google requests are blocked so no paid Places lookups run and no Google contributor photos appear.
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

SITE = 'https://hydrotylerking.github.io/hotsprings/'
OUT = 'store/screens'

# name, kind, basemap, view [lat, lon, zoom] or None, hash, actions (JS run after load)
SCENES = [
    ('phone-1-overview', 'phone', 'esritopo', [41.5, -114.5, 4.5], '', ['legend']),
    ('phone-2-soaks', 'phone', 'esritopo', [44.3, -115.3, 8], '', []),
    ('phone-3-detail', 'phone', 'esritopo', None, '#spring-791', []),
    ('phone-4-satellite', 'phone', 'imagery', [44.62, -110.75, 9.5], '', []),
    ('desktop-1-overview', 'desktop', 'esritopo', [40.5, -112.5, 5.5], '', ['legend', 'filters', 'results']),
    ('desktop-2-detail', 'desktop', 'esritopo', None, '#spring-791', ['legend']),
    ('desktop-3-soaks', 'desktop', 'usgstopo', [44.2, -115.4, 8.5], '', ['legend', 'soak', 'results']),
    ('desktop-4-satellite', 'desktop', 'imagery', [44.6, -110.7, 10], '', ['legend']),
]

ACT = {
    'legend': "localStorage.setItem('wt-leg','1')",
}

async def shoot(b, name, kind, bm, view, hsh, acts):
    if kind == 'phone':
        ctx = await b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=3, is_mobile=True, has_touch=True)
    else:
        ctx = await b.new_context(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)
    await ctx.route('**/*', lambda r: r.abort() if 'googleapis.com' in r.request.url or 'gstatic.com/maps' in r.request.url else r.continue_())
    init = "localStorage.setItem('wt-bm','%s');" % bm + ("localStorage.setItem('wt-leg','1');" if 'legend' in acts else "localStorage.setItem('wt-leg','0');")
    await ctx.add_init_script(init)
    pg = await ctx.new_page()
    await pg.goto(SITE + '?shot=1' + hsh, wait_until='networkidle')
    await pg.wait_for_timeout(2500)
    if view:
        await pg.evaluate('([a,b,z]) => { window.wtMap.setView([a,b], z, {animate:false}); return 0; }', view)
    if 'filters' in acts:
        await pg.evaluate("document.getElementById('fold') && document.getElementById('fold').click()")
    if 'soak' in acts:
        await pg.evaluate("(()=>{const s=document.getElementById('soak'); s.value='DW'; s.dispatchEvent(new Event('change'));})()")
    if 'results' in acts:
        await pg.evaluate("(()=>{const r=document.getElementById('rfold'); if (r && r.getAttribute('aria-expanded')!=='true') r.click();})()")
    await pg.add_style_tag(content='#gphoto{display:none!important}')
    await pg.wait_for_load_state('networkidle')
    await pg.wait_for_timeout(4000)
    path = f'{OUT}/{name}.png'
    await pg.screenshot(path=path)
    print('saved', path, flush=True)
    await ctx.close()

async def main():
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for s in SCENES:
            if only and s[0] not in only:
                continue
            await shoot(b, *s)
        await b.close()

asyncio.run(main())
