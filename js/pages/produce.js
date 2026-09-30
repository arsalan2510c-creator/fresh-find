/* Produce guide — one guide per produce item, aggregated across all market JSON files */
(function () {
  'use strict';
  const { $, $$, data, guideCard, pager, reveal, syncSaveButtons, inSeason, curMonth, esc, url } = FF;
  const grid = $('#guideGrid'), pagerEl = $('#guidePager'), countEl = $('#guideCount'), chips = $('#catChips');
  const q = $('#gq'), mSel = $('#gmarket'), avail = $('#gavail'), sortSel = $('#gsort');
  const PER = 8;
  const ICONS = { All: 'basket-shopping', Fruits: 'apple-whole', Vegetables: 'carrot', 'Herbs & Greens': 'leaf', Organic: 'seedling', 'In season': 'sun' };
  let guides = [], cat = 'All', page = 1;

  const params = new URLSearchParams(location.search);
  if (params.get('q')) q.value = params.get('q');
  if (params.get('cat')) cat = params.get('cat');

  grid.innerHTML = Array(8).fill('<div class="skel" aria-hidden="true"></div>').join('');

  Promise.all([data.produce(), data.markets()]).then(([gs, ms]) => {
    guides = gs;
    mSel.insertAdjacentHTML('beforeend', ms.map((m) => `<option value="${m.slug}">${esc(m.name)}</option>`).join(''));
    if (params.get('market')) mSel.value = params.get('market');
    const groups = ['All', 'Fruits', 'Vegetables', 'Herbs & Greens', 'In season', 'Organic'];
    const countFor = (c) => c === 'All' ? gs.length : c === 'In season' ? gs.filter(inSeason).length : c === 'Organic' ? gs.filter((g) => g.organic).length : gs.filter((g) => g.category === c).length;
    chips.innerHTML = groups.map((c) => `<button class="chip" aria-pressed="${c === cat}" data-cat="${esc(c)}"><span class="icon-bubble"><i class="fa-solid fa-${ICONS[c]}" aria-hidden="true"></i></span><span><b>${c === 'All' ? 'All produce' : esc(c)}</b><small>${countFor(c)} guides</small></span></button>`).join('');
    renderSeason();
    render();
  });

  function filtered() {
    const term = q.value.trim().toLowerCase();
    let list = guides.filter((g) => {
      if (cat === 'In season' && !inSeason(g)) return false;
      if (cat === 'Organic' && !g.organic) return false;
      if (!['All', 'In season', 'Organic'].includes(cat) && g.category !== cat) return false;
      if (mSel.value && !g.items.some((i) => i.market === mSel.value)) return false;
      if (avail.value === 'season' && !inSeason(g)) return false;
      if (avail.value === 'deal' && !g.items.some((i) => i.discount)) return false;
      return !term || (g.name + ' ' + g.category + ' ' + (g.info ? g.info.flavor : '')).toLowerCase().includes(term);
    });
    const by = {
      season: (a, b) => inSeason(b) - inSeason(a) || b.rating - a.rating,
      az: (a, b) => a.name.localeCompare(b.name),
      popular: (a, b) => b.reviews - a.reviews,
      'price-asc': (a, b) => a.minPrice - b.minPrice,
      'price-desc': (a, b) => b.minPrice - a.minPrice
    };
    return list.sort(by[sortSel.value]);
  }
  function render() {
    const list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER));
    page = Math.min(page, pages);
    countEl.textContent = `${list.length} guides`;
    grid.innerHTML = list.length ? list.slice((page - 1) * PER, page * PER).map((g, i) => guideCard(g, i)).join('')
      : `<div class="empty"><i class="fa-solid fa-lemon"></i><h3>No produce found</h3><p>Try another search or category.</p><button class="btn btn--dark" id="clearG">Clear filters</button></div>`;
    pager(pagerEl, page, pages, (p) => { page = p; render(); $('#browse').scrollIntoView({ behavior: 'smooth' }); });
    syncSaveButtons(); reveal(grid);
    const c = $('#clearG'); if (c) c.onclick = () => { $('#guideFilters').reset(); cat = 'All'; $$('[data-cat]', chips).forEach((x) => x.setAttribute('aria-pressed', x.dataset.cat === 'All')); render(); };
  }

  function renderSeason() {
    const m = curMonth(), next = (m % 12) + 1, next2 = (next % 12) + 1;
    const link = (g) => `<a href="${url('product.html?item=' + g.slug)}">${esc(g.name)}</a>`;
    const now = guides.filter((g) => g.info && g.info.peak.includes(m)).slice(0, 5);
    const soon = guides.filter((g) => g.info && !g.info.peak.includes(m) && (g.info.peak.includes(next) || g.info.peak.includes(next2))).slice(0, 5);
    const year = guides.filter((g) => g.info && g.info.peak.length + g.info.shoulder.length >= 8).slice(0, 5);
    $('#seasonNow').innerHTML = now.map(link).join(' · ') || '—';
    $('#seasonSoon').innerHTML = soon.map(link).join(' · ') || '—';
    $('#seasonYear').innerHTML = year.map(link).join(' · ') || '—';
    const name = new Date().toLocaleString('en', { month: 'long' }), nName = new Date(2000, next - 1).toLocaleString('en', { month: 'long' });
    $('#seasonLabel').textContent = `This month · ${name}–${nName}`;
  }

  chips.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; $$('[data-cat]', chips).forEach((x) => x.setAttribute('aria-pressed', x === b)); page = 1; render(); });
  $('#guideFilters').addEventListener('submit', (e) => { e.preventDefault(); page = 1; render(); });
  let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { page = 1; render(); }, 160); });
  [mSel, avail, sortSel].forEach((s) => s.addEventListener('change', () => { page = 1; render(); }));
  $('#openCalendar').addEventListener('click', () => { avail.value = 'season'; cat = 'All'; $$('[data-cat]', chips).forEach((x) => x.setAttribute('aria-pressed', x.dataset.cat === 'All')); page = 1; render(); $('#browse').scrollIntoView({ behavior: 'smooth' }); });
})();
