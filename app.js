/* Wildflower Touring — Hot Springs Map
   Data: NOAA Thermal Springs List for the United States (KGRD No. 12, 1980). */
(function () {
  'use strict';

  const NAMES = {AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',MA:'Massachusetts',MT:'Montana',NV:'Nevada',NM:'New Mexico',NY:'New York',NC:'North Carolina',OR:'Oregon',SD:'South Dakota',TX:'Texas',UT:'Utah',VA:'Virginia',WA:'Washington',WV:'West Virginia',WY:'Wyoming'};
  const COLORS = {B:'#d7191c', H:'#f28c28', W:'#f5d327', '':'#222'};
  const LABEL = {B:'Boiling', H:'Hot', W:'Warm', '':'Not available'};
  const ORDER = {'':0, W:1, H:2, B:3};
  // Land status from USGS PAD-US (see data/springs.json land_source)
  const MGR = {USFS:'US Forest Service', BLM:'Bureau of Land Management', NPS:'National Park Service', FWS:'US Fish & Wildlife Service', USBR:'Bureau of Reclamation', DOD:'Dept. of Defense',
    SDNR:'State land', SDOL:'State land', SLB:'State trust land', SPR:'State parks', SFW:'State fish & wildlife', OTHS:'State', CNTY:'County', CITY:'City', REG:'Regional district',
    TRIB:'Tribal', NGO:'Nonprofit', PVT:'Private', UNK:'Unknown'};
  const LANDCAT = {P:['Public land · open access','pub'], R:['Public land · restricted access','res'], U:['Public land · access unknown','res'], M:['Military · closed','no'], T:['Tribal land','no'], N:['Nonprofit preserve','no'], V:['Private','no']};
  const landShort = d => !d.land ? 'Private or unmapped' : d.land[0] === 'P' ? 'Public' : d.land[0] === 'R' || d.land[0] === 'U' ? 'Public (limited)' : LANDCAT[d.land[0]][0];
  const PIN = '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
  const $ = id => document.getElementById(id);
  const title = s => s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const gmaps = d => 'https://www.google.com/maps/search/?api=1&query=' + d.lat + ',' + d.lon;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // ---------- Basemaps ----------
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  const USGS = 'https://basemap.nationalmap.gov/arcgis/rest/services/';
  const ESRI_ATTR = 'Tiles &copy; Esri and contributors';
  const USGS_ATTR = 'Tiles: <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map" target="_blank" rel="noopener">USGS The National Map</a>';
  const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
  // thumb: a z5 tile over Idaho (x=5, y=11)
  const BASEMAPS = [
    {id:'usgstopo', name:'USGS Topo', url:USGS+'USGSTopo/MapServer/tile/{z}/{y}/{x}', opt:{maxNativeZoom:16, attribution:USGS_ATTR}},
    {id:'opentopo', name:'OpenTopoMap', url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', opt:{maxNativeZoom:17, subdomains:'abc', attribution:'Map: &copy; <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA), ' + OSM_ATTR}},
    {id:'imagery', name:'Satellite', url:ESRI+'World_Imagery/MapServer/tile/{z}/{y}/{x}', opt:{maxNativeZoom:19, attribution:ESRI_ATTR + ' (Maxar, Earthstar Geographics)'}, imagery:true},
    {id:'usgsimg', name:'USGS Imagery + Topo', url:USGS+'USGSImageryTopo/MapServer/tile/{z}/{y}/{x}', opt:{maxNativeZoom:16, attribution:USGS_ATTR}},
    {id:'esritopo', name:'Esri Topo', url:ESRI+'World_Topo_Map/MapServer/tile/{z}/{y}/{x}', opt:{maxNativeZoom:19, attribution:ESRI_ATTR}},
    {id:'relief', name:'Shaded relief', url:USGS+'USGSShadedReliefOnly/MapServer/tile/{z}/{y}/{x}', opt:{maxNativeZoom:16, attribution:USGS_ATTR}, imagery:true},
    {id:'osm', name:'Streets (OSM)', url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png', opt:{maxNativeZoom:19, attribution:OSM_ATTR}},
    {id:'light', name:'Light', url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', opt:{maxNativeZoom:20, subdomains:'abcd', attribution:OSM_ATTR + ' &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'}},
    {id:'dark', name:'Dark', url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', opt:{maxNativeZoom:20, subdomains:'abcd', attribution:OSM_ATTR + ' &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'}, dark:true}
  ];
  const thumb = b => b.url.replace('{s}', (b.opt.subdomains || 'a')[0]).replace('{z}', 5).replace('{x}', 5).replace('{y}', 11).replace('{r}', '');

  // ---------- Map ----------
  const map = L.map('map', {preferCanvas:true, zoomSnap:0.5, worldCopyJump:true, minZoom:2, maxZoom:19});
  map.fitBounds([[24.5,-125],[49.5,-66.5]]);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  const renderer = L.canvas({padding:0.3, tolerance:4});

  let baseLayer = null, curBM = null;
  const labels = L.layerGroup([
    L.tileLayer(ESRI+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {maxNativeZoom:19, maxZoom:19}),
    L.tileLayer(ESRI+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {maxNativeZoom:19, maxZoom:19, attribution:ESRI_ATTR})
  ]);
  const grid = $('bmgrid');
  BASEMAPS.forEach(b => {
    const s = document.createElement('button');
    s.className = 'sw'; s.dataset.id = b.id; s.type = 'button';
    s.innerHTML = '<img loading="lazy" alt="" src="' + thumb(b) + '">' + esc(b.name);
    s.onclick = () => setBM(b.id, true);
    grid.appendChild(s);
  });
  function setBM(id, userPicked) {
    const b = BASEMAPS.find(x => x.id === id) || BASEMAPS[0];
    if (baseLayer) map.removeLayer(baseLayer);
    baseLayer = L.tileLayer(b.url, Object.assign({maxZoom:19, detectRetina:false}, b.opt)).addTo(map);
    baseLayer.bringToBack();
    curBM = b;
    grid.querySelectorAll('.sw').forEach(s => s.classList.toggle('on', s.dataset.id === b.id));
    if (userPicked) { $('ovLabels').checked = !!b.imagery; }
    applyLabels();
    store.set('wt-bm', b.id);
  }
  function applyLabels() {
    if ($('ovLabels').checked) labels.addTo(map); else map.removeLayer(labels);
  }
  $('ovLabels').onchange = applyLabels;
  const bmEl = $('bm');
  $('bmbtn').onclick = e => { e.stopPropagation(); bmEl.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', bmEl.classList.contains('open')); };
  document.addEventListener('click', e => { if (!bmEl.contains(e.target)) bmEl.classList.remove('open'); });
  L.DomEvent.disableClickPropagation(bmEl); L.DomEvent.disableScrollPropagation(bmEl);
  L.DomEvent.disableClickPropagation($('legend'));
  {
    const saved = store.get('wt-bm', 'usgstopo');
    const b = BASEMAPS.find(x => x.id === saved) || BASEMAPS[0];
    $('ovLabels').checked = !!b.imagery;
    setBM(b.id, false);
  }

  // ---------- Locate control ----------
  let me = null, meMarker = null;
  const Locate = L.Control.extend({
    options:{position:'topleft'},
    onAdd() {
      const bar = L.DomUtil.create('div', 'leaflet-bar');
      const a = L.DomUtil.create('a', 'locate', bar);
      a.href = '#'; a.title = 'Show my location'; a.setAttribute('role', 'button'); a.innerHTML = '◎';
      L.DomEvent.on(a, 'click', e => { L.DomEvent.preventDefault(e); L.DomEvent.stopPropagation(e); locate(true); });
      this.btn = a; return bar;
    }
  });
  const locateCtl = new Locate().addTo(map);
  function locate(zoom) {
    if (!navigator.geolocation) { alertMsg('Location is not available in this browser.'); return; }
    locateCtl.btn.classList.add('busy');
    navigator.geolocation.getCurrentPosition(p => {
      locateCtl.btn.classList.remove('busy');
      me = [p.coords.latitude, p.coords.longitude];
      if (meMarker) meMarker.setLatLng(me);
      else { meMarker = L.circleMarker(me, {radius:7, color:'#fff', weight:2.5, fillColor:'#1a73e8', fillOpacity:1, renderer}).addTo(map); meMarker.bindPopup('You are here'); }
      if (zoom) map.setView(me, Math.max(map.getZoom(), 8));
      update();
    }, err => {
      locateCtl.btn.classList.remove('busy');
      alertMsg('Could not get your location' + (err && err.message ? ': ' + err.message : '.'));
      if ($('sort').value === 'near') { $('sort').value = 'name'; update(); }
    }, {enableHighAccuracy:false, timeout:12000, maximumAge:300000});
  }
  function alertMsg(m) {
    const d = $('detail'); d.style.display = 'block';
    d.innerHTML = '<button class="x" title="Close">✕</button><div></div>';
    d.lastChild.textContent = m; d.querySelector('.x').onclick = () => { d.style.display = 'none'; };
  }
  function distMi(d) {
    if (!me) return null;
    const R = 3958.8, toR = Math.PI / 180;
    const dLat = (d.lat - me[0]) * toR, dLon = (d.lon - me[1]) * toR;
    const a = Math.sin(dLat/2)**2 + Math.cos(me[0]*toR) * Math.cos(d.lat*toR) * Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // Hover labels only where a real hover exists; on touch screens a tap would show the label and the popup together.
  const canHover = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);

  // ---------- State ----------
  let S = [], unit = store.get('wt-unit', 'F'), sel = null, current = [];
  const show = {B:true, H:true, W:true, '':true};
  const fmt = (d, u = unit) => d.f == null ? (d.cls ? LABEL[d.cls] : '—') : (u === 'F' ? d.f + '°F' : d.c + '°C');
  const tempLong = d => d.f == null ? (d.cls ? LABEL[d.cls] + ' (no reading listed)' : 'Not available') : d.f + '°F / ' + d.c + '°C';

  fetch('data/springs.json').then(r => r.json()).then(init).catch(err => {
    alertMsg('Could not load spring data (' + err + ').');
  });

  function init(json) {
    S = json.springs.map((r, i) => ({i, name:r[0] || 'Unnamed spring', unnamed:!r[0], st:r[1], lat:r[2], lon:r[3], f:r[4], c:r[5], cls:r[6], quad:(r[7] || '').replace(/^\(|\)$/g, ''), land:r[8] || null}));
    // markers (hotter drawn on top)
    S.slice().sort((a, b) => ORDER[a.cls] - ORDER[b.cls]).forEach(d => {
      d.m = L.circleMarker([d.lat, d.lon], {renderer, radius:5, weight:1, color:'#000', opacity:.55, fillColor:COLORS[d.cls], fillOpacity:.95});
      if (canHover) d.m.bindTooltip(() => esc(title(d.name)) + ' · ' + fmt(d), {direction:'top', offset:[0,-4]});
      d.m.on('click', () => select(d, false));
    });
    // state dropdown
    const counts = {};
    S.forEach(d => counts[d.st] = (counts[d.st] || 0) + 1);
    Object.keys(counts).sort((a, b) => NAMES[a].localeCompare(NAMES[b])).forEach(s => {
      const o = document.createElement('option'); o.value = s; o.textContent = NAMES[s] + ' (' + counts[s] + ')'; $('state').appendChild(o);
    });
    setUnit(unit); restyle(); update();
    openFromHash();
  }

  // ---------- Marker size by zoom ----------
  function restyle() {
    const z = map.getZoom(), r = z < 5 ? 4 : z < 7 ? 5 : z < 10 ? 6.5 : 8;
    S.forEach(d => d.m.setStyle(d === sel ? {radius:r + 3, weight:3, color:'#00a3ff', opacity:1} : {radius:r, weight:1, color:curBM && (curBM.dark || curBM.imagery) ? '#fff' : '#000', opacity:curBM && (curBM.dark || curBM.imagery) ? .8 : .55}));
  }
  map.on('zoomend', restyle);
  map.on('baselayerchange', restyle);

  // ---------- Filtering ----------
  const q = $('q'), stSel = $('state'), sortSel = $('sort'), minT = $('minT'), landSel = $('land');
  const minF = () => +minT.value;
  function passes(d) {
    const term = q.value.trim().toLowerCase(), st = stSel.value, m = minF(), lf = landSel.value;
    if (lf) {
      const c = d.land ? d.land[0] : '';
      // private = no PAD-US parcel (usually private), private ranches, or nonprofit preserves
      const ok = lf === 'open' ? c === 'P' : lf === 'limited' ? c === 'R' || c === 'U' : lf === 'public' ? 'PRU'.includes(c) && c !== '' : c === '' || c === 'V' || c === 'N';
      if (!ok) return false;
    }
    return show[d.cls] && (!st || d.st === st) && (!term || d.name.toLowerCase().includes(term)) && (m <= 60 || (d.f != null && d.f >= m));
  }
  function update() {
    const inView = $('inView').checked && !document.querySelector('.app').classList.contains('max') ? map.getBounds() : (lastBounds && $('inView').checked ? lastBounds : null);
    const visible = [];
    S.forEach(d => {
      const ok = passes(d);
      if (ok) { if (!map.hasLayer(d.m)) d.m.addTo(map); } else if (map.hasLayer(d.m)) map.removeLayer(d.m);
      if (ok && (!inView || inView.contains([d.lat, d.lon]))) visible.push(d);
    });
    if (sel && map.hasLayer(sel.m)) sel.m.bringToFront();
    const s = sortSel.value, tv = d => d.f == null ? ({B:212, H:150, W:90}[d.cls] ?? -1) : d.f;
    const clean = n => n.replace(/^\W+/, '');
    if (s === 'near' && me) visible.forEach(d => d.dist = distMi(d));
    visible.sort(
      s === 'hot' ? (a, b) => tv(b) - tv(a) :
      s === 'cold' ? (a, b) => { const x = tv(a), y = tv(b); return (x < 0) - (y < 0) || x - y; } :
      s === 'near' && me ? (a, b) => a.dist - b.dist :
      (a, b) => a.unnamed - b.unnamed || clean(a.name).localeCompare(clean(b.name)));
    current = visible;
    document.querySelector('.app').classList.toggle('near', s === 'near' && !!me);
    $('count').textContent = current.length.toLocaleString() + (inView ? ' in view' : ' of 1,661');
    activeBadge(); renderList();
  }
  let lastBounds = null, moveTimer = null;
  map.on('moveend', () => { lastBounds = map.getBounds(); clearTimeout(moveTimer); moveTimer = setTimeout(() => { if ($('inView').checked) update(); }, 60); });

  // ---------- List ----------
  const list = $('list'); let shown = 0;
  function renderList() { list.innerHTML = ''; shown = 0; list.scrollTop = 0; more(); }
  function more() {
    const frag = document.createDocumentFragment();
    for (const d of current.slice(shown, shown + 200)) {
      const el = document.createElement('div');
      el.className = 'it' + (d === sel ? ' sel' : ''); el.dataset.i = d.i;
      const dist = d.dist != null && me ? (d.dist < 10 ? d.dist.toFixed(1) : Math.round(d.dist).toLocaleString()) + ' mi' : '';
      el.innerHTML = '<span class="dot" style="background:' + COLORS[d.cls] + '"></span><span class="nm">' + esc(title(d.name)) + '</span><span class="st">' + d.st +
        '</span><span class="tp">' + fmt(d) + '</span><span class="tc">' + (d.c == null ? '—' : d.c + '°C') + '</span><span class="cl">' + LABEL[d.cls] +
        '</span><span class="ld" title="' + esc(d.land ? d.land[2] : '') + '">' + esc(d.land ? d.land[2] : landShort(d)) + '</span><span class="qd">' + esc(d.quad) + '</span><span class="ds">' + dist +
        '</span><a class="gm" title="Open in Google Maps" target="_blank" rel="noopener" href="' + gmaps(d) + '">' + PIN + '</a>';
      frag.appendChild(el);
    }
    shown += 200; list.appendChild(frag);
  }
  list.addEventListener('scroll', () => { if (list.scrollTop + list.clientHeight > list.scrollHeight - 200 && shown < current.length) more(); });
  list.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const it = e.target.closest('.it'); if (!it) return;
    if (app.classList.contains('max')) toggleMax(false);
    select(S[+it.dataset.i], true);
  });

  // ---------- Selection, popup, detail ----------
  function popupHtml(d) {
    return '<div class="pop"><a target="_blank" rel="noopener" title="Open in Google Maps" href="' + gmaps(d) + '">' + PIN + esc(title(d.name)) + '</a><div class="t">Temperature: <b>' + tempLong(d).replace(' (no reading listed)', '') + '</b></div></div>';
  }
  function select(d, fly) {
    sel = d; restyle(); if (map.hasLayer(d.m)) d.m.bringToFront();
    list.querySelectorAll('.it').forEach(el => el.classList.toggle('sel', +el.dataset.i === d.i));
    const det = $('detail'); det.style.display = 'block';
    const lat = Math.abs(d.lat).toFixed(3) + '°' + (d.lat >= 0 ? 'N' : 'S'), lon = Math.abs(d.lon).toFixed(3) + '°' + (d.lon < 0 ? 'W' : 'E');
    const dist = distMi(d);
    det.innerHTML = '<button class="x" title="Close">✕</button><h2>' + esc(title(d.name)) + '</h2><table>' +
      '<tr><td>State</td><td>' + NAMES[d.st] + '</td></tr>' +
      '<tr><td>Temperature</td><td>' + tempLong(d) + '</td></tr>' +
      '<tr><td>Class</td><td><span class="dot" style="background:' + COLORS[d.cls] + ';vertical-align:-1px"></span> ' + LABEL[d.cls] + '</td></tr>' +
      '<tr><td>Latitude, longitude</td><td>' + lat + ', ' + lon + '</td></tr>' +
      '<tr><td>Land</td><td>' + (d.land ? esc(d.land[2]) + (MGR[d.land[1]] && !d.land[2].includes(MGR[d.land[1]]) ? ' <span style="color:var(--muted)">(' + MGR[d.land[1]] + ')</span>' : '') + '<br><span class="landtag ' + LANDCAT[d.land[0]][1] + '" style="margin-left:0">' + LANDCAT[d.land[0]][0] + '</span>' : '<span class="landtag no" style="margin-left:0">Private or unmapped</span>') + '</td></tr>' +
      (d.quad ? '<tr><td>USGS quadrangle</td><td>' + esc(d.quad) + '</td></tr>' : '') +
      (dist != null ? '<tr><td>Distance from you</td><td>' + Math.round(dist).toLocaleString() + ' mi (straight line)</td></tr>' : '') +
      '</table><a class="gbtn" target="_blank" rel="noopener" href="' + gmaps(d) + '">' + PIN + ' Open in Google Maps</a>';
    det.querySelector('.x').onclick = () => { sel = null; det.style.display = 'none'; map.closePopup(); restyle(); list.querySelectorAll('.it.sel').forEach(e => e.classList.remove('sel')); setHash(''); };
    const open = () => L.popup({offset:[0,-4], autoPan:!fly, closeButton:true}).setLatLng([d.lat, d.lon]).setContent(popupHtml(d)).openOn(map);
    if (fly) { map.once('moveend', open); map.flyTo([d.lat, d.lon], Math.max(map.getZoom(), 11), {duration:.8}); } else open();
    setHash('spring-' + d.i);
  }
  map.on('popupclose', () => {});

  // shareable links: #spring-123
  function setHash(h) { try { history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); } catch (e) {} }
  function openFromHash() {
    const m = /^#spring-(\d+)$/.exec(location.hash);
    if (m && S[+m[1]]) select(S[+m[1]], true);
  }
  window.addEventListener('hashchange', openFromHash);

  // ---------- Controls ----------
  function legendText() {
    const t = unit === 'F' ? {B:'(≥194°F)', H:'(122–193°F)', W:'(<122°F)'} : {B:'(≥90°C)', H:'(50–89°C)', W:'(<50°C)'};
    document.querySelectorAll('.lt').forEach(el => el.textContent = t[el.dataset.k]);
  }
  function minLabel() { const v = minF(); $('minTv').textContent = v <= 60 ? 'any' : (unit === 'F' ? v + '°F' : Math.round((v - 32) * 5 / 9) + '°C'); }
  function setUnit(u) {
    unit = u; store.set('wt-unit', u);
    document.querySelectorAll('#units button').forEach(x => x.classList.toggle('on', x.dataset.u === u));
    minLabel(); legendText(); if (S.length) { renderList(); if (sel) $('detail').querySelector('h2') && select(sel, false); }
  }
  $('units').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setUnit(b.dataset.u); });
  function activeBadge() {
    let n = 0; if (landSel.value) n++; if (q.value.trim()) n++; if (stSel.value) n++; if (minF() > 60) n++; if (sortSel.value !== 'name') n++; if (!$('inView').checked) n++;
    const a = $('active'); a.textContent = n + (n === 1 ? ' filter' : ' filters'); a.style.display = n ? 'inline' : 'none';
  }
  const fold = $('fold'), ctr = $('controls');
  fold.onclick = () => { const open = ctr.hidden; ctr.hidden = !open; fold.setAttribute('aria-expanded', open); if (open) q.focus({preventScroll:true}); };
  q.addEventListener('input', update);
  landSel.addEventListener('change', update);
  $('inView').addEventListener('change', update);
  sortSel.addEventListener('change', () => { if (sortSel.value === 'near' && !me) locate(false); update(); });
  minT.addEventListener('input', () => { minLabel(); update(); });
  stSel.addEventListener('change', () => {
    const st = stSel.value;
    if (!st) map.flyToBounds([[24.5,-125],[49.5,-66.5]], {duration:.6});
    else { const pts = S.filter(d => d.st === st).map(d => [d.lat, d.lon]); map.flyToBounds(L.latLngBounds(pts).pad(0.1), {duration:.6, maxZoom:9}); }
    update();
  });
  document.querySelectorAll('#legend input').forEach(cb => cb.addEventListener('change', () => { show[cb.dataset.c] = cb.checked; update(); }));
  // legend collapse
  const legbtn = $('legbtn'), legbody = $('legbody');
  function setLeg(open) { legbody.hidden = !open; legbtn.setAttribute('aria-expanded', open); }
  setLeg(store.get('wt-leg', window.innerWidth > 760 ? '1' : '0') === '1');
  legbtn.onclick = () => { const open = legbody.hidden; setLeg(open); store.set('wt-leg', open ? '1' : '0'); };
  // expand table
  const app = $('app'), maxbtn = $('maxbtn');
  function toggleMax(on) {
    if (on === undefined) on = !app.classList.contains('max');
    app.classList.toggle('max', on);
    maxbtn.textContent = on ? '⤡ Show map' : '⤢ Expand';
    maxbtn.title = on ? 'Back to the map' : 'Expand the results table';
    if (!on) setTimeout(() => { map.invalidateSize(); update(); }, 0); else update();
  }
  maxbtn.onclick = () => { if (app.classList.contains('rc')) setResults(true); toggleMax(); };
  // collapsible results list (starts collapsed)
  const rfold = $('rfold');
  function setResults(open) {
    app.classList.toggle('rc', !open); rfold.setAttribute('aria-expanded', open);
    if (!open && app.classList.contains('max')) toggleMax(false);
    setTimeout(() => map.invalidateSize(), 0);
  }
  rfold.onclick = () => setResults(app.classList.contains('rc'));
  new ResizeObserver(() => map.invalidateSize()).observe($('mapwrap'));
})();
