/* Market detail — products come from the market's own JSON file */
(function () {
  'use strict';
  const { $, $$, data, productCard, marketCard, marketStatus, distanceKm, pager, reveal, syncSaveButtons, lightbox, openLayer, closeLayer, store, toast, esc, stars } = FF;
  const slug = document.body.dataset.market;
  const grid = $('#productGrid'), pagerEl = $('#productPager'), countEl = $('#productCount');
  const q = $('#pq'), sortSel = $('#psort'), priceSel = $('#pprice'), pills = $('#catPills');
  const PER = 10;
  let products = [], info = {}, cat = 'All', page = 1;

  grid.innerHTML = Array(5).fill('<div class="skel" aria-hidden="true"></div>').join('');

  Promise.all([data.market(slug), data.products(slug), data.info(), data.markets()]).then(([m, list, inf, all]) => {
    info = inf;
    products = list.map((p) => Object.assign({}, p, { market: slug, marketName: m.name }));
    // Live open/closed status
    const s = marketStatus(m);
    const tag = $('#openTag'); tag.textContent = s.label; tag.classList.toggle('closed', !s.open);
    $('#featuredCount').textContent = products.length;
    $('#statProducts').textContent = products.length;
    // Category pills with counts
    const cats = ['All', ...new Set(products.map((p) => p.category))];
    pills.innerHTML = cats.map((c) => `<button class="pill" aria-pressed="${c === cat}" data-cat="${esc(c)}">${esc(c)} <span class="muted">(${c === 'All' ? products.length : products.filter((p) => p.category === c).length})</span></button>`).join('');
    render();
    // Related markets = 3 nearest to this one
    const rel = all.filter((x) => x.slug !== slug).sort((a, b) => distanceKm(a, m) - distanceKm(b, m)).slice(0, 3);
    $('#relatedGrid').innerHTML = rel.map(marketCard).join('');
    syncSaveButtons(); reveal();
  }).catch(() => { grid.innerHTML = `<div class="empty"><h3>Products unavailable</h3><p>Please refresh the page.</p></div>`; });

  function filtered() {
    const term = q.value.trim().toLowerCase();
    let list = products.filter((p) => (cat === 'All' || p.category === cat) && (!term || (p.name + ' ' + p.description + ' ' + (p.badge || '')).toLowerCase().includes(term)));
    const [lo, hi] = (priceSel.value || '0-999999').split('-').map(Number);
    list = list.filter((p) => p.price >= lo && p.price <= hi);
    const by = {
      featured: (a, b) => (b.featured - a.featured) || b.rating - a.rating,
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
      discount: (a, b) => (parseInt(b.discount) || 0) - (parseInt(a.discount) || 0)
    };
    return list.sort(by[sortSel.value]);
  }
  function render() {
    const list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER));
    page = Math.min(page, pages);
    countEl.textContent = `Showing ${list.length} of ${products.length} products`;
    grid.innerHTML = list.length ? list.slice((page - 1) * PER, page * PER).map((p, i) => productCard(p, info, i)).join('')
      : `<div class="empty"><i class="fa-solid fa-carrot"></i><h3>Nothing matches</h3><p>Try another category or search term.</p></div>`;
    pager(pagerEl, page, pages, (p) => { page = p; render(); $('#produce').scrollIntoView({ behavior: 'smooth' }); });
    syncSaveButtons(); reveal(grid);
  }
  pills.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; $$('[data-cat]', pills).forEach((x) => x.setAttribute('aria-pressed', x === b)); page = 1; render(); });
  let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { page = 1; render(); }, 160); });
  [sortSel, priceSel].forEach((s) => s.addEventListener('change', () => { page = 1; render(); }));

  /* Gallery lightbox */
  const gBtns = $$('.gallery button');
  const open = lightbox(gBtns.map((b) => ({ src: b.dataset.full, alt: $('img', b).alt })));
  gBtns.forEach((b, i) => b.addEventListener('click', () => open(i)));

  /* Reviews — seeded + user-written (stored per market) */
  const key = 'reviews:' + slug;
  const revGrid = $('#reviewGrid');
  function renderUserReviews() {
    $$('.review.is-new', revGrid).forEach((r) => r.remove());
    store.get(key, []).forEach((r) => {
      revGrid.insertAdjacentHTML('afterbegin', `<article class="review is-new"><div class="stars" aria-label="${r.rating} out of 5">${stars(r.rating)}</div><blockquote>“${esc(r.text)}”</blockquote><b>${esc(r.name)}</b><small>Your review · ${new Date(r.at).toLocaleDateString()}</small></article>`);
    });
  }
  renderUserReviews();
  const modal = $('#reviewModal'), rf = $('#reviewForm');
  $('#writeReview').addEventListener('click', () => {
    const u = store.get('user', null); if (u) rf.rname.value = u.first + ' ' + (u.last || '').charAt(0) + '.';
    openLayer(modal);
  });
  rf.addEventListener('submit', (e) => {
    e.preventDefault();
    const rating = +(rf.querySelector('input[name=rating]:checked') || {}).value || 0;
    const name = rf.rname.value.trim(), text = rf.rtext.value.trim();
    let ok = true;
    const setErr = (el, bad) => { el.closest('.field').classList.toggle('invalid', bad); if (bad) ok = false; };
    setErr(rf.querySelector('.star-input'), !rating);
    setErr(rf.rname, name.length < 2);
    setErr(rf.rtext, text.length < 10);
    if (!ok) return;
    const list = store.get(key, []); list.push({ rating, name, text, at: Date.now() }); store.set(key, list);
    renderUserReviews(); rf.reset(); closeLayer(modal);
    toast('Thanks! Your review has been published');
    $('#reviews').scrollIntoView({ behavior: 'smooth' });
  });
})();
