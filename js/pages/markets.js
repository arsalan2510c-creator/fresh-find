/* Market directory — renders every market from data/markets.json */
(function () {
  'use strict';
  const { $, data, marketCard, marketStatus, distanceKm, locate, pager, reveal, syncSaveButtons, toast, esc } = FF;
  const grid = $('#marketGrid'), pagerEl = $('#marketPager'), count = $('#marketCount');
  const form = $('#marketFilters'), q = $('#mq'), dist = $('#mdist'), open = $('#mopen'), sort = $('#msort');
  const PER = 6;
  let markets = [], page = 1;

  const params = new URLSearchParams(location.search);
  if (params.get('q')) q.value = params.get('q');

  grid.innerHTML = Array(6).fill('<div class="skel" aria-hidden="true"></div>').join('');

  data.markets().then((ms) => { markets = ms; render(); }).catch(() => {
    grid.innerHTML = `<div class="empty"><i class="fa-solid fa-triangle-exclamation"></i><h3>Couldn't load markets</h3><p>Please refresh the page.</p></div>`;
  });

  function filtered() {
    const term = q.value.trim().toLowerCase();
    let list = markets.filter((m) => !term || [m.name, m.area, m.address, m.type, m.tagline].join(' ').toLowerCase().includes(term));
    const d = +dist.value; if (d) list = list.filter((m) => distanceKm(m) <= d);
    if (open.value === 'now') list = list.filter((m) => marketStatus(m).open);
    if (open.value === 'early') list = list.filter((m) => m.hours.open <= 5);
    if (open.value === 'late') list = list.filter((m) => m.hours.close >= 22);
    const by = {
      recommended: (a, b) => b.rating * Math.log(b.reviews) - a.rating * Math.log(a.reviews),
      nearest: (a, b) => distanceKm(a) - distanceKm(b),
      rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
      vendors: (a, b) => parseInt(b.vendors) - parseInt(a.vendors),
      az: (a, b) => a.name.localeCompare(b.name)
    };
    return list.sort(by[sort.value] || by.recommended);
  }

  function render() {
    const list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER));
    page = Math.min(page, pages);
    count.textContent = `${list.length} ${list.length === 1 ? 'market' : 'markets'} found`;
    grid.innerHTML = list.length
      ? list.slice((page - 1) * PER, page * PER).map(marketCard).join('')
      : `<div class="empty"><i class="fa-solid fa-store-slash" aria-hidden="true"></i><h3>No markets match</h3><p>Try a different area or clear the filters.</p><button class="btn btn--dark" id="clearFilters">Clear filters</button></div>`;
    pager(pagerEl, page, pages, (p) => { page = p; render(); $('#directory').scrollIntoView({ behavior: 'smooth' }); });
    syncSaveButtons(); reveal(grid);
    const c = $('#clearFilters'); if (c) c.onclick = reset;
  }
  function reset() { form.reset(); page = 1; render(); }

  form.addEventListener('submit', (e) => { e.preventDefault(); page = 1; render(); });
  let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { page = 1; render(); }, 180); });
  [dist, open, sort].forEach((s) => s.addEventListener('change', () => { page = 1; render(); }));
  $('#resetFilters').addEventListener('click', reset);

  $('#nearMe').addEventListener('click', (e) => {
    const b = e.currentTarget; b.disabled = true; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating…';
    locate().then(() => { sort.value = 'nearest'; toast('Showing markets nearest to you', 'location-crosshairs'); render(); })
      .catch(() => toast('Location unavailable — distances are from Saddar', 'location-dot'))
      .finally(() => { b.disabled = false; b.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Near me'; });
  });
})();
