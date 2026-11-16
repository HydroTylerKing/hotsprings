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
  const CAM = '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>';
  const BOOK = '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4a2 2 0 0 1 2-2h13v17H6a1 1 0 0 0 0 2h13v1H6a3 3 0 0 1-3-3V4zm4 2v2h8V6z"/></svg>';
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
    {id:'light', name:'Light', url:ESRI+'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', opt:{maxNativeZoom:16, attribution:ESRI_ATTR + ' (Light Gray Canvas)'}},
    {id:'dark', name:'Dark', url:ESRI+'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', opt:{maxNativeZoom:16, attribution:ESRI_ATTR + ' (Dark Gray Canvas)'}, dark:true}
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

  // ---------- Saved & visited (kept on this device) ----------
  const loadSet = k => { try { return new Set(JSON.parse(store.get(k, '[]'))); } catch (e) { return new Set(); } };
  const saved = loadSet('wt-saved'), visited = loadSet('wt-visited');
  const saveSet = (k, s) => store.set(k, JSON.stringify([...s]));

  // ---------- State ----------
  let S = [], unit = store.get('wt-unit', 'F'), sel = null, current = [];
  const show = {B:true, H:true, W:true, '':true};
  const fmt = (d, u = unit) => d.f == null ? (d.cls ? LABEL[d.cls] : '—') : (u === 'F' ? d.f + '°F' : d.c + '°C');
  const tempLong = d => d.f == null ? (d.cls ? LABEL[d.cls] + ' (no reading listed)' : 'Not available') : d.f + '°F / ' + d.c + '°C';

  // Wikipedia article / Commons photo matched to each spring (data/media.json); text and credits load live
  let MEDIA = {};
  const mediaReady = fetch('data/media.json?v=1').then(r => r.ok ? r.json() : {m:{}}).then(j => { MEDIA = j.m || {}; }).catch(() => {});
  Promise.all([fetch('data/springs.json').then(r => r.json()), mediaReady]).then(([j]) => init(j)).catch(err => {
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
    S.forEach(d => d.m.setStyle(d === sel ? {radius:r + 3, weight:3, color:'#00a3ff', opacity:1} : saved.has(d.i) ? {radius:r + 1, weight:2.5, color:'#be6b47', opacity:1} : {radius:r, weight:1, color:curBM && (curBM.dark || curBM.imagery) ? '#fff' : '#000', opacity:curBM && (curBM.dark || curBM.imagery) ? .8 : .55}));
  }
  map.on('zoomend', restyle);
  map.on('baselayerchange', restyle);

  // ---------- Filtering ----------
  const q = $('q'), stSel = $('state'), sortSel = $('sort'), minT = $('minT'), landSel = $('land'), mineSel = $('mine');
  const minF = () => +minT.value;
  function passes(d) {
    const term = q.value.trim().toLowerCase(), st = stSel.value, m = minF(), lf = landSel.value, mf = mineSel.value;
    if (mf && !(mf === 'saved' ? saved.has(d.i) : mf === 'visited' ? visited.has(d.i) : !visited.has(d.i))) return false;
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
  map.on('moveend', () => { const sz = map.getSize(); if (!sz.x || !sz.y || !$('mapwrap').offsetWidth) return; lastBounds = map.getBounds(); clearTimeout(moveTimer); moveTimer = setTimeout(() => { if ($('inView').checked) update(); }, 60); });

  // ---------- List ----------
  const list = $('list'); let shown = 0;
  function renderList() { list.innerHTML = ''; shown = 0; list.scrollTop = 0; more(); }
  function more() {
    const frag = document.createDocumentFragment();
    for (const d of current.slice(shown, shown + 200)) {
      const el = document.createElement('div');
      el.className = 'it' + (d === sel ? ' sel' : ''); el.dataset.i = d.i;
      const dist = d.dist != null && me ? (d.dist < 10 ? d.dist.toFixed(1) : Math.round(d.dist).toLocaleString()) + ' mi' : '';
      el.innerHTML = '<span class="dot" style="background:' + COLORS[d.cls] + '"></span>' + (saved.has(d.i) ? '<span class="fv" title="Saved">★</span>' : visited.has(d.i) ? '<span class="fv v" title="Visited">✓</span>' : '') + '<span class="nm">' + esc(title(d.name)) + '</span><span class="st">' + d.st +
        '</span><span class="tp">' + fmt(d) + '</span><span class="tc">' + (d.c == null ? '—' : d.c + '°C') + '</span><span class="cl">' + LABEL[d.cls] +
        '</span><span class="ld" title="' + esc(d.land ? d.land[2] : '') + '">' + esc(d.land ? d.land[2] : landShort(d)) + '</span><span class="qd">' + esc(d.quad) + '</span><span class="ds">' + dist +
        '</span>' + (MEDIA[d.i] ? '<span class="mi" title="' + (MEDIA[d.i][1] ? 'Has photo' : 'Has description') + '">' + (MEDIA[d.i][1] ? CAM : BOOK) + '</span>' : '<span class="mi"></span>') + '<a class="gm" title="Open in Google Maps" target="_blank" rel="noopener" href="' + gmaps(d) + '">' + PIN + '</a>';
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
    det.innerHTML = '<button class="x" title="Close">✕</button><h2>' + esc(title(d.name)) + '</h2>' +
      '<div class="mybtns"><button class="mybtn sav' + (saved.has(d.i) ? ' on' : '') + '">' + (saved.has(d.i) ? '★ Saved' : '☆ Save') + '</button><button class="mybtn vis' + (visited.has(d.i) ? ' on' : '') + '">' + (visited.has(d.i) ? '✓ Visited' : 'Mark visited') + '</button></div><table>' +
      '<tr><td>State</td><td>' + NAMES[d.st] + '</td></tr>' +
      '<tr><td>Temperature</td><td>' + tempLong(d) + '</td></tr>' +
      '<tr><td>Class</td><td><span class="dot" style="background:' + COLORS[d.cls] + ';vertical-align:-1px"></span> ' + LABEL[d.cls] + '</td></tr>' +
      '<tr><td>Latitude, longitude</td><td>' + lat + ', ' + lon + '</td></tr>' +
      '<tr><td>Land</td><td>' + (d.land ? esc(d.land[2]) + (MGR[d.land[1]] && !d.land[2].includes(MGR[d.land[1]]) ? ' <span style="color:var(--muted)">(' + MGR[d.land[1]] + ')</span>' : '') + '<br><span class="landtag ' + LANDCAT[d.land[0]][1] + '" style="margin-left:0">' + LANDCAT[d.land[0]][0] + '</span>' : '<span class="landtag no" style="margin-left:0">Private or unmapped</span>') + '</td></tr>' +
      (d.quad ? '<tr><td>USGS quadrangle</td><td>' + esc(d.quad) + '</td></tr>' : '') +
      (dist != null ? '<tr><td>Distance from you</td><td>' + Math.round(dist).toLocaleString() + ' mi (straight line)</td></tr>' : '') +
      '</table><div class="gphoto" id="gphoto" hidden></div>' + (MEDIA[d.i] ? '<div class="about" id="about"><div class="ab-load">Loading description…</div></div>' : '') + '<a class="gbtn" target="_blank" rel="noopener" href="' + gmaps(d) + '">' + PIN + ' Open in Google Maps</a>';
    det.querySelector('.mybtn.sav').onclick = e => { saved.has(d.i) ? saved.delete(d.i) : saved.add(d.i); saveSet('wt-saved', saved); e.currentTarget.classList.toggle('on', saved.has(d.i)); e.currentTarget.textContent = saved.has(d.i) ? '★ Saved' : '☆ Save'; restyle(); renderList(); };
    det.querySelector('.mybtn.vis').onclick = e => { visited.has(d.i) ? visited.delete(d.i) : visited.add(d.i); saveSet('wt-visited', visited); e.currentTarget.classList.toggle('on', visited.has(d.i)); e.currentTarget.textContent = visited.has(d.i) ? '✓ Visited' : 'Mark visited'; renderList(); };
    if (MEDIA[d.i]) loadAbout(d);
    loadGooglePhoto(d);
    det.querySelector('.x').onclick = () => { sel = null; det.style.display = 'none'; map.closePopup(); restyle(); list.querySelectorAll('.it.sel').forEach(e => e.classList.remove('sel')); setHash(''); };
    // On wider screens the panel floats over the left of the map: keep the spring and its popup clear of it.
    const panelW = () => { const a = document.querySelector('aside'); return (window.innerWidth > 760 && !app.classList.contains('max') && a) ? a.getBoundingClientRect().right - $('mapwrap').getBoundingClientRect().left : 0; };
    const pw = panelW();
    const open = () => L.popup({offset:[0,-4], autoPan:true, autoPanPaddingTopLeft:[pw + 16, 16], closeButton:true}).setLatLng([d.lat, d.lon]).setContent(popupHtml(d)).openOn(map);
    if (fly) {
      const z = Math.max(map.getZoom(), 11);
      const target = pw ? map.unproject(map.project([d.lat, d.lon], z).subtract([pw / 2, 0]), z) : L.latLng(d.lat, d.lon);
      map.once('moveend', open); map.flyTo(target, z, {duration:.8});
    } else open();
    setHash('spring-' + d.i);
  }
  map.on('popupclose', () => {});

  // ---------- Description & photo (Wikipedia / Wikimedia Commons) ----------
  const mediaCache = {};
  const fmtDate = s => { if (!s) return ''; const m = /^(\d{4})(?:[-:](\d{2}))?(?:[-:](\d{2}))?/.exec(String(s).trim()); if (!m) return ''; const dt = new Date(Date.UTC(+m[1], m[2] ? +m[2] - 1 : 0, m[3] ? +m[3] : 1)); return m[3] ? dt.toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric', timeZone:'UTC'}) : m[2] ? dt.toLocaleDateString(undefined, {year:'numeric', month:'short', timeZone:'UTC'}) : m[1]; };
  const stripHtml = s => { const el = document.createElement('div'); el.innerHTML = s || ''; return (el.textContent || '').replace(/\s+/g, ' ').trim(); };
  async function wikiApi(base, params) {
    const p = new URLSearchParams(Object.assign({action:'query', format:'json', formatversion:'2', origin:'*'}, params));
    const r = await fetch(base + '?' + p); return r.json();
  }
  async function getMedia(i) {
    if (mediaCache[i]) return mediaCache[i];
    const [title, file] = MEDIA[i]; const out = {};
    const jobs = [];
    if (title) jobs.push(wikiApi('https://en.wikipedia.org/w/api.php', {prop:'extracts|revisions|info', titles:title, exintro:1, explaintext:1, exsentences:4, rvprop:'timestamp', rvlimit:1, inprop:'url', redirects:1}).then(j => {
      const p = j.query && j.query.pages && j.query.pages[0];
      if (p && !p.missing && p.extract) out.wiki = {title:p.title, text:p.extract, url:p.fullurl, edited:p.revisions && p.revisions[0] && p.revisions[0].timestamp};
    }).catch(() => {}));
    if (file) jobs.push(wikiApi('https://commons.wikimedia.org/w/api.php', {prop:'imageinfo', titles:file, iiprop:'url|extmetadata', iiurlwidth:640}).then(j => {
      const p = j.query && j.query.pages && j.query.pages[0], ii = p && p.imageinfo && p.imageinfo[0];
      if (!ii) return; const md = ii.extmetadata || {}; const v = k => md[k] && md[k].value;
      const lic = stripHtml(v('LicenseShortName'));
      if (!/cc|public domain|pd|gfdl|no restrictions/i.test(lic) || /fair use|non-free/i.test(lic)) return;
      out.photo = {src:ii.thumburl || ii.url, page:ii.descriptionurl, artist:stripHtml(v('Artist')) || 'Unknown author', license:lic, licenseUrl:v('LicenseUrl') || '', taken:v('DateTimeOriginal') ? stripHtml(v('DateTimeOriginal')) : '', uploaded:v('DateTime') || ''};
    }).catch(() => {}));
    await Promise.all(jobs);
    return mediaCache[i] = out;
  }
  async function loadAbout(d) {
    const m = await getMedia(d.i);
    const box = $('about'); if (!box || sel !== d) return;
    let h = '';
    if (m.photo) {
      const when = m.photo.taken ? 'taken ' + fmtDate(m.photo.taken) : m.photo.uploaded ? 'uploaded ' + fmtDate(m.photo.uploaded) : '';
      h += '<figure><a href="' + esc(m.photo.page) + '" target="_blank" rel="noopener"><img src="' + esc(m.photo.src) + '" alt="Photo near ' + esc(title(d.name)) + '" loading="lazy"></a>' +
        '<figcaption>Photo: ' + esc(m.photo.artist) + ', <a href="' + esc(m.photo.page) + '" target="_blank" rel="noopener">Wikimedia Commons</a> · ' +
        (m.photo.licenseUrl ? '<a href="' + esc(m.photo.licenseUrl) + '" target="_blank" rel="noopener">' + esc(m.photo.license) + '</a>' : esc(m.photo.license)) + (when ? ' · ' + when : '') + '</figcaption></figure>';
    }
    if (m.wiki) {
      const txt = m.wiki.text.length > 700 ? m.wiki.text.slice(0, 700).replace(/\s+\S*$/, '') + '…' : m.wiki.text;
      h += '<p class="ab-text"></p><div class="ab-src">From Wikipedia, <a href="' + esc(m.wiki.url) + '" target="_blank" rel="noopener">“' + esc(m.wiki.title) + '”</a>' +
        (m.wiki.edited ? ', last edited ' + fmtDate(m.wiki.edited) : '') + ' · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a></div>';
      box.innerHTML = h; box.querySelector('.ab-text').textContent = txt;
    } else box.innerHTML = h || '';
    if (!h) box.remove();
  }

  // ---------- Google Maps place photo (Places API, shown live; nothing is stored) ----------
  const GKEY = (window.WT_CONFIG && window.WT_CONFIG.googleMapsKey) || '';
  let gLib = null; const gCache = {};
  function loadGoogle() {
    if (!GKEY) return Promise.reject(new Error('no key'));
    if (gLib) return gLib;
    gLib = new Promise((resolve, reject) => {
      window.__wtGoogleReady = () => google.maps.importLibrary('places').then(resolve, reject);
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(GKEY) + '&v=weekly&loading=async&callback=__wtGoogleReady';
      s.async = true; s.onerror = () => reject(new Error('Google Maps failed to load'));
      document.head.appendChild(s);
    });
    return gLib;
  }
  const GEN = new Set(['hot','warm','spring','springs','the','of','and','at','near','in','on','thermal','mineral','unnamed','group','area','no','north','south','east','west','upper','lower','big','little','creek','river','lake','canyon','valley','mountain','mtn','mt','pool','pools','well','wells','seep','seeps','geothermal','vent','vents','fumarole','fumaroles','resort','baths','bath','spa','ranch','old','new','site','county','national','park','forest','city']);
  const toks = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const distinctToks = s => toks(s).filter(w => !GEN.has(w) && w.length > 2);
  const kmBetween = (a, b, c, d) => { const t = Math.PI / 180, x = (c - a) * t, y = (d - b) * t; const h = Math.sin(x / 2) ** 2 + Math.cos(a * t) * Math.cos(c * t) * Math.sin(y / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  async function findGooglePhoto(d) {
    if (d.i in gCache) return gCache[d.i];
    const want = distinctToks(d.name);
    if (!want.length) return gCache[d.i] = null;           // generic names ("Hot Spring") can't be matched reliably
    const lib = await loadGoogle();
    const {places} = await lib.Place.searchByText({
      textQuery: title(d.name) + ' ' + NAMES[d.st],
      fields: ['displayName', 'location', 'photos', 'googleMapsURI'],
      locationBias: {center: {lat: d.lat, lng: d.lon}, radius: 3000},
      maxResultCount: 5
    });
    for (const p of places || []) {
      if (!p.photos || !p.photos.length || !p.location) continue;
      const have = new Set(toks(p.displayName || ''));
      const nameOk = want.every(w => have.has(w) || have.has(w.replace(/s$/, '')) || have.has(w + 's'));
      if (!nameOk || kmBetween(d.lat, d.lon, p.location.lat(), p.location.lng()) > 3) continue;
      const ph = p.photos[0];
      return gCache[d.i] = {src: ph.getURI({maxWidth: 640}), place: p.displayName, mapsUrl: p.googleMapsURI, authors: (ph.authorAttributions || []).map(a => ({name: a.displayName, uri: a.uri}))};
    }
    return gCache[d.i] = null;
  }
  async function loadGooglePhoto(d) {
    if (!GKEY) return;
    let g = null; try { g = await findGooglePhoto(d); } catch (e) { return; }
    const box = $('gphoto'); if (!box || sel !== d || !g) return;
    const by = g.authors.length ? g.authors.map(a => a.uri ? '<a href="' + esc(a.uri) + '" target="_blank" rel="noopener">' + esc(a.name) + '</a>' : esc(a.name)).join(', ') : 'a Google Maps contributor';
    box.innerHTML = '<figure><a href="' + esc(g.mapsUrl || gmaps(d)) + '" target="_blank" rel="noopener"><img src="' + esc(g.src) + '" alt="Google Maps photo of ' + esc(g.place) + '" loading="lazy"></a>' +
      '<figcaption>Photo of “' + esc(g.place) + '” by ' + by + ' · <a href="' + esc(g.mapsUrl || gmaps(d)) + '" target="_blank" rel="noopener">Google Maps</a></figcaption></figure>';
    box.hidden = false;
  }

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
    let n = 0; if (landSel.value) n++; if (mineSel.value) n++; if (q.value.trim()) n++; if (stSel.value) n++; if (minF() > 60) n++; if (sortSel.value !== 'name') n++; if (!$('inView').checked) n++;
    const a = $('active'); a.textContent = n + (n === 1 ? ' filter' : ' filters'); a.style.display = n ? 'inline' : 'none';
  }
  const fold = $('fold'), ctr = $('controls');
  fold.onclick = () => { const open = ctr.hidden; ctr.hidden = !open; fold.setAttribute('aria-expanded', open); if (open) q.focus({preventScroll:true}); };
  q.addEventListener('input', update);
  landSel.addEventListener('change', update);
  mineSel.addEventListener('change', update);
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
  new ResizeObserver(() => { if ($('mapwrap').offsetWidth) map.invalidateSize(); }).observe($('mapwrap'));
  // ---------- App: offline support, install button, offline notice ----------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (!standalone) { $('installbtn').hidden = false; $('aboutInstall').hidden = false; } });
  const doInstall = async () => { if (!installEvt) { openAbout(); return; } installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; $('installbtn').hidden = true; $('aboutInstall').hidden = true; };
  $('installbtn').onclick = doInstall; $('aboutInstall').onclick = doInstall;
  window.addEventListener('appinstalled', () => { $('installbtn').hidden = true; $('aboutInstall').hidden = true; });
  if (standalone) $('installHelp').textContent = 'You\'re using the installed app. Spring data and the areas you\'ve viewed are saved for offline use.';
  const netState = () => { $('offline').hidden = navigator.onLine; };
  window.addEventListener('online', netState); window.addEventListener('offline', netState); netState();

  // ---------- About dialog (logo click, or #about link) ----------
  const aboutDlg = $('about');
  function openAbout() { if (!aboutDlg.open) { if (aboutDlg.showModal) aboutDlg.showModal(); else aboutDlg.setAttribute('open', ''); } }
  function closeAbout() { if (aboutDlg.close) aboutDlg.close(); else aboutDlg.removeAttribute('open'); if (location.hash === '#about') setHash(''); }
  $('aboutbtn').onclick = () => { openAbout(); setHash('about'); };
  $('aboutClose').onclick = closeAbout;
  aboutDlg.addEventListener('click', e => { if (e.target !== aboutDlg) return; const r = aboutDlg.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeAbout(); });   // click on the backdrop
  aboutDlg.addEventListener('close', () => { if (location.hash === '#about') setHash(''); });
  if (location.hash === '#about') openAbout();
  window.addEventListener('hashchange', () => { if (location.hash === '#about') openAbout(); });
})();
